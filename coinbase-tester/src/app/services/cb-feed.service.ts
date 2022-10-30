import { Injectable } from '@angular/core';
import { filter, firstValueFrom, from, map, timer } from 'rxjs';

import {
  CbRestService,
  GetProductCandlesArgs,
  RestResponseTrade,
} from './cb-rest.service';
import { BollingerBands, NotEnoughDataError, SMA } from 'trading-signals';
import {
  ActiveSocket,
  CbSocketService,
  MatchMessage,
} from './cb-socket.service';

const STARTER_CANDLE: Candle = {
  high: 0,
  low: 0,
  open: 0,
  close: 0,
  volume: 0,
  timestamp: 0,
  date: new Date(),
  timeSinceLastCandle: 0,
  minute: 0,
};

@Injectable({
  providedIn: 'root',
})
export class CbFeedService {
  // I suspect a reliable strategy would be to always place buy and sell orders but distance and scale them based on the signals
  // My buys move closer and/or higher or further and/or lower and sells do the opposite based on signals
  // Although, there may be viable exceptions where the scale should move away from the signal...
  // (basically as a lose stop loss)

  currentMinute?: number;

  currentCandle: Candle = STARTER_CANDLE;
  lastCandle: Candle = STARTER_CANDLE;

  // Should be able to derive other candle intervals from this
  // todo: store in db (possibly in chunks or nested by day/hour/minute)
  // Then keep track of a relevant subset of candles in memory
  pastCandles: Candle[] = [];

  constructor(
    private restSvc: CbRestService,
    private socketSvc: CbSocketService
  ) {}

  getLinearTrades$ = (productId: string, cooldownInMs: number) =>
    from(this.getLinearTrades(productId, cooldownInMs));

  getLinearTrades = async (productId: string, cooldownInMs: number) => {
    console.log('getting Linear Trades', { productId, cooldownInMs });
    const socket = this.socketSvc.createSocket<MatchMessage>();
    socket.addMatchSubscription([productId]);

    let socketTrades: MergedTrade[] = [];
    let restTrades: MergedTrade[] = [];

    const socketSubscription = socket.lastMessage$
      .pipe(filter((msg) => msg.type === 'last_match' || msg.type === 'match'))
      .subscribe((msg) => {
        console.log('socket msg', msg.trade_id);
        socketTrades.push(this.processTrade(msg, productId));
      });

    const processedTradeStream$ = socket.lastMessage$.pipe(
      map((msg) => this.processTrade(msg, productId))
    );

    const getRestTrades = async () => {
      const trades = await this.restSvc.getProductTrades(productId);
      if (!trades) {
        throw new Error(`No trades returned for ${productId}`);
      }
      return trades.map((trade) => this.processTrade(trade, productId));
    };

    // Could be functional (take in socketTrades and restTrades as args) for composability
    const checkForIntersection = () => {
      console.log('checking for intersection');
      const socketIds = socketTrades.map((trade) => trade.tradeId);
      const restIds = restTrades.map((trade) => trade.tradeId);
      const lastSocketId = socketIds[socketIds.length - 1];
      const firstSocketId = socketIds[0];
      const firstRestId = restIds[0];
      // Ensure overlap between rest and socket trades
      if (lastSocketId >= firstRestId && firstSocketId <= firstRestId) {
        console.log('intersection found');
        console.log({ lastSocketId, firstSocketId, firstRestId });
        return true;
      }
      console.log('no intersection found');
      console.log({ lastSocketId, firstSocketId, firstRestId });
      return false;
    };

    // Here we make sure there is some overlap between the socket and rest trades
    const checkUntilMatch = async () => {
      await firstValueFrom(timer(cooldownInMs));
      restTrades = await getRestTrades();
      const wasIntersectionFound = checkForIntersection();
      if (wasIntersectionFound) {
        return;
      }
      await checkUntilMatch();
    };

    await checkUntilMatch();

    // Here we create a continuous history and attempt to transfer the socket watch immediately
    const transferFeed = () => {
      const historicalTradesMap: Record<number, MergedTrade> = {};
      for (let trade of restTrades) {
        historicalTradesMap[trade.tradeId] = trade;
      }
      for (let trade of socketTrades) {
        historicalTradesMap[trade.tradeId] = trade;
      }
      const historicalTrades = Object.values(historicalTradesMap);
      socketSubscription.unsubscribe();
      // I believe this could still lead to a very  tight race condition
      // but if we can miss a single trade without ruining the analysis maybe that is okay...
      // But, what if that trade is worth fa million dollars? I will just alert in the component for now
      return {
        historicalTrades,
        processedTradeStream$,
      };
    };

    return {
      socket,
      transferFeed,
    };
  };

  getCandles = (args: GetProductCandlesArgs) => {
    // const end = new Date();
    // 5 minutes ago
    // const start = new Date(end.getTime() - 5 * 60000);
    // const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 30);
    this.restSvc.getProductCandles(args).then((res: any) => {
      if (!res) {
        return;
      }
      let lastCandleTimestamp =
        new Date(res[res.length - 1][0] * 1000).getTime() - 60000;
      const candles: Candle[] = res.reverse().map((data: any) => {
        const [time, low, high, open, close, volume] = data;
        const date = new Date(time * 1000);
        const timestamp = date.getTime();
        const timeSinceLastCandle = timestamp - lastCandleTimestamp;
        const candle: Candle = {
          high,
          low,
          open,
          close,
          volume,
          timestamp,
          timeSinceLastCandle,
          date,
          minute: date.getMinutes(),
        };
        lastCandleTimestamp = timestamp;
        return candle;
      });
      this.pastCandles = candles;
      this.lastCandle = candles[candles.length - 1];
    });
  };

  // === HELPERS ===

  // note the typing needs work. This will let undefined productId through.
  processTrade = (
    match: MatchMessage | RestResponseTrade,
    productId: string
  ): MergedTrade => ({
    price: Number(match.price),
    size: Number(match.size),
    date: new Date(match.time),
    side: match.side,
    tradeId: match.trade_id,
    productId: productId,
  });
}

// Models (should go elsewhere one day)
export type MergedTrade = {
  price: number;
  size: number;
  date: Date;
  side: 'buy' | 'sell';
  tradeId: number;
  productId: string;
};

export type MergedTrades<T> = {
  pastTrades: MergedTrade[];
  socket: ActiveSocket<T>;
  // temp
  intersection: number[];
};

// Maybe a new CandleService could manage these things
// Some of these number types could be Big numbers
type Candle = {
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
  timestamp: number;
  date: Date;
  minute: number;
  timeSinceLastCandle: number; // For testing only (I think, since it is theoretically inferrable)
};
