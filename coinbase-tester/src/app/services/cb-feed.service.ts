import { Injectable } from '@angular/core';
import { filter, firstValueFrom, from, map, timer } from 'rxjs';

import {
  CbRestService,
  GetProductCandlesArgs,
  GetProductTradesArgs,
  RestResponseTrade,
} from './cb-rest.service';
import { BollingerBands, NotEnoughDataError, SMA } from 'trading-signals';
import { CbSocketService, MatchMessage } from './cb-socket.service';
import Big from 'big.js';
import { Candle } from './candle.service';

@Injectable({
  providedIn: 'root',
})
export class CbFeedService {
  // I suspect a reliable strategy would be to always place buy and sell orders but distance and scale them based on the signals
  // My buys move closer and/or higher or further and/or lower and sells do the opposite based on signals
  // Although, there may be viable exceptions where the scale should move away from the signal...
  // (basically as a lose stop loss)

  constructor(
    private restSvc: CbRestService,
    private socketSvc: CbSocketService
  ) {}

  getCbCandles = async (args: GetProductCandlesArgs) => {
    const res = await this.restSvc.getProductCandles(args);

    return res.map((candle: any) => this.processCandle(candle)) as Candle[];
  };

  getCbTrades = async (args: GetProductTradesArgs) => {
    const { cbBefore, cbAfter, cbTrades } = await this.restSvc.getProductTrades(
      args
    );
    const trades = cbTrades.map((trade) =>
      this.processTrade(trade, args.productId)
    );
    return { cbBefore, cbAfter, trades };
  };

  // candidate for rename
  getLinearTrades = async (productId: string, cooldownInMs: number) => {
    const socket = this.socketSvc.createSocket<MatchMessage>();
    socket.addMatchSubscription([productId]);

    let socketTrades: MergedTrade[] = [];
    let restTrades: MergedTrade[] = [];

    const socketSubscription = socket.lastMessage$
      .pipe(filter((msg) => msg.type === 'last_match' || msg.type === 'match'))
      .subscribe((msg) => {
        socketTrades.push(this.processTrade(msg, productId));
      });

    const tradeStream$ = socket.lastMessage$.pipe(
      filter((msg) => msg.type === 'match'),
      map((msg) => this.processTrade(msg, productId))
    );

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
        // console.log({ lastSocketId, firstSocketId, firstRestId });
        return true;
      }
      console.log('no intersection found');
      // console.log({ lastSocketId, firstSocketId, firstRestId });
      return false;
    };

    // Here we make sure there is some overlap between the socket and rest trades
    const checkUntilMatch = async () => {
      await firstValueFrom(timer(cooldownInMs));
      const { trades } = await this.getCbTrades({
        productId,
      });
      restTrades = trades;

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
        tradeStream$,
      };
    };

    return {
      socket,
      transferFeed,
    };
  };

  // === HELPERS ===

  processCandle = (
    candle: [number, number, number, number, number, number]
  ): Candle => {
    const [time, cbLow, cbHigh, cbOpen, cbClose, cbVolume] = candle;
    const high = Big(cbHigh);
    const low = Big(cbLow);
    const open = Big(cbOpen);
    const close = Big(cbClose);
    const volume = Big(cbVolume);
    const date = new Date(time * 1000);
    const timestamp = date.getTime();
    const minute = date.getMinutes();
    return {
      high,
      low,
      open,
      close,
      volume,
      date,
      timestamp,
      minute,
    };
  };

  processTrades = (
    trades: RestResponseTrade[],
    productId: string
  ): MergedTrade[] =>
    trades.map((trade) => this.processTrade(trade, productId));

  // note the typing needs work. This will let undefined productId through.
  processTrade = (
    match: MatchMessage | RestResponseTrade,
    productId: string
  ): MergedTrade => ({
    price: Big(match.price),
    size: Big(match.size),
    date: new Date(match.time),
    side: match.side,
    tradeId: match.trade_id,
    productId: productId,
  });
}

// Models (should go elsewhere one day)
export type MergedTrade = {
  price: Big;
  size: Big;
  date: Date;
  side: 'buy' | 'sell';
  tradeId: number;
  productId: string;
};
