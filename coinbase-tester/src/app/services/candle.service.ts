import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CbFeedService, MergedTrade } from './cb-feed.service';
import { CbRestService } from './cb-rest.service';
import { Big } from 'big.js';

@Injectable({
  providedIn: 'root',
})
export class CandleService {
  // I suspect a reliable strategy would be to always place buy and sell orders but distance and scale them based on the signals
  // My buys move closer and/or higher or further and/or lower and sells do the opposite based on signals
  // Although, there may be viable exceptions where the scale should move away from the price...

  // NOTE: I think I need to delay the call to REST so I can ensure my current candle is always aligned with the last one from REST
  // Possibly even do a check and restart the process if the last candle from REST is not the timing is off
  // Should be able to derive other candle intervals from this
  // todo: store in db (possibly in chunks or nested by day/hour/minute)
  // Could probably just grab candles from REST API instead of storing them
  // Then keep track of a relevant subset of candles in memory
  candles: Candle[] = [];
  wasTradeHistoryProcessed$ = new BehaviorSubject(false);
  currentMinute$ = new BehaviorSubject(0);
  // rename me
  syncedCandles: Candle[] = [];

  constructor(private feedSvc: CbFeedService, private restSvc: CbRestService) {}

  getRestCandles = async (productId: string) => {
    const res = await this.feedSvc.getCbCandles({
      productId,
      granularity: 60,
    });

    return res;
  };

  // Well now that I tried putting the rest candles beside my own I see there is virtually no discrepancy
  // I may go so far as to say that I only need to keep track of the current candle.
  // I could get the last one from REST each time a minute ticks over...

  buildInitialCandles = async (productId: string) => {
    let wasContinuityChecked = false;
    const { transferFeed } = await this.feedSvc.getLinearTrades(productId, 200);
    const { historicalTrades, tradeStream$ } = transferFeed();
    // attempt to reconcile history with stream
    tradeStream$.subscribe((trade) => {
      if (!wasContinuityChecked) {
        // ensure the final trade from history is just before the first trade in stream
        // Maybe not the best place for this check, but for now...
        const lastHistoricalId =
          historicalTrades[historicalTrades.length - 1].tradeId;
        const firstStreamId = trade.tradeId;
        if (lastHistoricalId !== firstStreamId - 1) {
          alert('Trade ID continuity was broken');
        }
        wasContinuityChecked = true;
      }
      if (!this.wasTradeHistoryProcessed$.value) {
        // process historical trades before stream
        console.log('creating historical candles');
        this.createHistoricalCandles(historicalTrades);
        this.wasTradeHistoryProcessed$.next(true);
        this.wasTradeHistoryProcessed$.complete();
      }
      this.addTradeToSet(trade, this.candles);
    });
    const restCandles = await this.getRestCandles(productId);
    this.syncedCandles = restCandles;
  };

  createHistoricalCandles = (trades: MergedTrade[]) => {
    for (let trade of trades) {
      this.addTradeToSet(trade, this.candles);
    }
  };

  createCandleSet = (trades: MergedTrade[]) => {
    const candles: Candle[] = [];
    for (let trade of trades) {
      this.addTradeToSet(trade, candles);
    }
    return candles;
  };

  addTradeToSet = (trade: MergedTrade, candles: Candle[]) => {
    const { price, size, date } = trade;
    const bPrice = new Big(price);
    const bSize = new Big(size);
    const timestamp = date.getTime();
    const minute = date.getMinutes();
    if (minute !== this.currentMinute$.value) {
      this.currentMinute$.next(minute);
    }
    const lastMinute = candles[candles.length - 1]?.minute ?? minute;

    if (minute !== lastMinute || !candles.length) {
      // create new candle
      const newCandle = {
        high: bPrice,
        low: bPrice,
        open: bPrice,
        close: bPrice,
        volume: bSize,
        timestamp,
        date,
        minute,
      };
      candles.push(newCandle);
    } else {
      // update current candle
      const currentCandle = candles[candles.length - 1];
      currentCandle.high = bPrice.gt(currentCandle.high)
        ? bPrice
        : currentCandle.high;
      // Math.max(currentCandle.high, price);
      currentCandle.low = bPrice.gt(currentCandle.low)
        ? currentCandle.low
        : bPrice;
      // Math.min(currentCandle.low, price);
      currentCandle.close = bPrice;
      currentCandle.volume = currentCandle.volume.plus(bSize);
      // currentCandle.volume += size;
      currentCandle.timestamp = timestamp;
    }
  };
}

// Maybe a new CandleService could manage these things
// Some of these number types could be Big numbers
export type Candle = {
  high: Big;
  low: Big;
  open: Big;
  close: Big;
  volume: Big;
  timestamp: number;
  date: Date;
  minute: number;
};
