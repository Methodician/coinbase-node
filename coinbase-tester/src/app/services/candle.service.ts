import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { CbFeedService, MergedTrade } from './cb-feed.service';
import { CbRestService } from './cb-rest.service';
import { Big } from 'big.js';
import { BollingerBands, SMA } from 'trading-signals';

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
  // rename me
  recentClosingPricesDepth = 30;
  recentClosingPrices: number[] = [];
  smaDepth = 7;
  sma = new SMA(this.smaDepth);
  bbDepth = 20;
  bb = new BollingerBands(this.bbDepth, 2);

  constructor(private feedSvc: CbFeedService, private restSvc: CbRestService) {}

  getRestCandles = async (productId: string) => {
    const res = await this.feedSvc.getCbCandles({
      productId,
      granularity: 60,
    });

    return res;
  };

  buildCandleStream = (
    historicalTrades: MergedTrade[],
    tradeStream$: Observable<MergedTrade>
  ) => {
    let wasContinuityChecked = false;
    // Maybe doesn't need to be observable
    const wasTradeHistoryProcessed$ = new BehaviorSubject(false);

    const currentMinute$ = new BehaviorSubject(0);
    const currentCandle$ = new BehaviorSubject<Candle | undefined>(undefined);

    const addTrade = (trade: MergedTrade) => {
      const { price, size, date } = trade;
      const minute = date.getMinutes();
      const timestamp = date.getTime();

      if (!currentCandle$.value) {
        currentCandle$.next({
          high: price,
          low: price,
          open: price,
          close: price,
          volume: size,
          date,
          timestamp,
          minute,
        });
      } else {
        if (currentCandle$.value.minute !== minute) {
          // minute gets iterated before candle
          // This lets buildSyncedCandles know to push the candle before it ticks over
          currentMinute$.next(minute);
          currentCandle$.next({
            high: price,
            low: price,
            open: price,
            close: price,
            volume: size,
            date,
            timestamp,
            minute,
          });
        } else {
          const currentCandle = currentCandle$.value;
          const { high, low, open, volume } = currentCandle;

          currentCandle$.next({
            high: price.gt(high) ? price : high,
            low: price.lt(low) ? price : low,
            open,
            close: price,
            volume: volume.plus(size),
            date,
            timestamp,
            minute,
          });
        }
      }
    };
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
      if (!wasTradeHistoryProcessed$.value) {
        // process historical trades before stream
        for (let trade of historicalTrades) {
          addTrade(trade);
        }
        wasTradeHistoryProcessed$.next(true);
        wasTradeHistoryProcessed$.complete();
      }
      addTrade(trade);
    });

    return {
      currentCandle$,
      currentMinute$,
      wasTradeHistoryProcessed$,
    };
  };

  buildSyncedCandles = async (
    productId: string,
    candleStream$: BehaviorSubject<Candle>,
    currentMinute$: BehaviorSubject<number>
  ) => {
    const syncUp = () =>
      new Promise<Candle[]>((resolve, reject) => {
        const recurse = async () => {
          try {
            console.log('syncing up');
            const candles = await this.getRestCandles(productId);
            candles.reverse();
            const poppedCandle = candles.pop();
            if (poppedCandle?.minute !== currentMinute$.value) {
              setTimeout(recurse, 350);
            } else {
              resolve(candles);
            }
          } catch (error) {
            reject(error);
          }
        };
        recurse();
      });

    const candles = await syncUp();
    candles.forEach((candle) => {
      this.addSma(candle);
      this.addBb(candle);
    });

    combineLatest([candleStream$, currentMinute$]).subscribe(
      ([candle, minute]) => {
        // Feels a little hacky and redundant but not sure maybe great
        // See comment in this.buildCandleStream
        if (minute !== candle.minute) {
          this.addSma(candle);
          this.addBb(candle);
          candles.push(candle);
        }
      }
    );

    return candles;
  };

  // Move to signal service? (already started)
  addBb = (candle: Candle) => {
    try {
      this.bb.update(candle.close.toString());
      if (this.recentClosingPrices.length >= this.bbDepth) {
        const bol = this.bb.getResult();
        candle.bb = {
          upper: new Big(bol.upper.toFixed(2).toString()),
          middle: new Big(bol.middle.toFixed(2).toString()),
          lower: new Big(bol.lower.toFixed(2).toString()),
        };
      }
    } catch (error) {
      console.log(error);
    }
  };

  // Move to signal service?
  addSma = (candle: Candle) => {
    try {
      this.sma.update(candle.close.toString());
      if (this.recentClosingPrices.length >= this.smaDepth) {
        const ma = this.sma.getResult();
        candle.ma = new Big(ma.toFixed(2).toString());
      }
    } catch (error) {
      console.log(error);
    }
  };

  // helpers
  logCandle = (candle: Candle) => {
    const loggable = {
      high: candle?.high.toString(),
      low: candle?.low.toString(),
      open: candle?.open.toString(),
      close: candle?.close.toString(),
      volume: candle?.volume.toString(),
      date: candle?.date,
      timestamp: candle?.timestamp,
      minute: candle?.minute,
    };
    console.log(loggable);
  };
}

// Thinking I should leave the candle type alone and add a new type called "tick" or something
// That could contain a candle as well as some signals
export type Candle = {
  high: Big;
  low: Big;
  open: Big;
  close: Big;
  volume: Big;
  timestamp: number;
  date: Date;
  minute: number;
  ma?: Big;
  bb?: {
    upper: Big;
    middle: Big;
    lower: Big;
  };
};
