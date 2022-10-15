import { Injectable } from '@angular/core';
import { filter, firstValueFrom, Subject, timer } from 'rxjs';

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
  ) {
    this.start();
  }

  // May not have a start at all. Could trigger from component to create a merged candle set
  // Candles may even be another service, along with analytics/signal processing
  // Must keep in mind all this should translate cleanly to a node server
  // And this var could be stored where this is triggered...
  start = () => {
    this.getMergedMatches('ETH-USD', 221);
  };

  // Can probably make this observable instead of promise so it can pipe ez.
  getMergedMatches = async (productId: string, cooldownInMs: number) => {
    const socket = this.socketSvc.createSocket<MatchMessage>();
    socket.addMatchSubscription([productId]);

    let socketTrades: MergedTrade[] = [];
    let restTrades: MergedTrade[] = [];

    const socketSubscription = socket.lastMessage$
      .pipe(filter((msg) => msg.type === 'last_match' || msg.type === 'match'))
      .subscribe((msg) => {
        socketTrades.push(this.processTrade(msg, productId));
      });

    const restUntilMatch = async (): Promise<number[]> => {
      const trades = await this.restSvc.getProductTrades(productId);
      if (!trades) {
        throw new Error(`No trades found for ${productId}`);
      }
      restTrades = trades.map((trade) => this.processTrade(trade, productId));

      const restIds = restTrades.map((trade) => trade.tradeId);
      const intersectionIds = socketTrades
        .map((trade) => trade.tradeId)
        .filter((tradeId) => restIds.includes(tradeId));

      if (intersectionIds.length) {
        socketSubscription.unsubscribe();
        return intersectionIds;
      } else {
        await firstValueFrom(timer(cooldownInMs));
        return restUntilMatch();
      }
    };

    // These trade IDs are always sequential numbers.
    // I can probably use that to be more efficient.
    const intersectionIds = await restUntilMatch();

    // Filter out duplicates
    const pastTrades = [...restTrades, ...socketTrades].filter(
      (trade, index, trades) => {
        const tradeIds = trades.map((trade) => trade.tradeId);
        return tradeIds.indexOf(trade.tradeId) === index;
      }
    );

    return {
      socket,
      intersectionIds,
      socketTrades,
      restTrades,
      pastTrades,
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
