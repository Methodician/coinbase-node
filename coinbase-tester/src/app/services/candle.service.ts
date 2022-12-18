import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { CbFeedService, MergedTrade } from './cb-feed.service';
import { Big } from 'big.js';
import { BandsResult } from 'trading-signals';

@Injectable({
  providedIn: 'root',
})
export class CandleService {
  // I suspect a reliable strategy would be to always place buy and sell orders but distance and scale them based on the signals
  // My buys move closer and/or higher or further and/or lower and sells do the opposite based on signals
  // Although, there may be viable exceptions where the scale should move away from the price...
  // todo: store things I can't get from REST in db (possibly in chunks or nested by day/hour/minute)

  // May move feedSvc related stuff into aggregator too so we can avoid circular dependency
  constructor(private feedSvc: CbFeedService) {}

  buildCandleStream = (
    historicalTrades: MergedTrade[],
    tradeStream$: Observable<MergedTrade>
  ) => {
    return new Promise<{
      currentMinute$: BehaviorSubject<number>;
      currentCandle$: Subject<Candle>;
    }>((resolve, reject) => {
      console.log('building stream');

      let currentCandle: Candle;

      const currentMinute$ = new BehaviorSubject(0);
      const currentCandle$ = new Subject<Candle>();

      const addTrade = (trade: MergedTrade) => {
        const { price, size, date } = trade;
        const minute = date.getMinutes();
        const timestamp = date.getTime();

        if (!currentCandle) {
          currentCandle = {
            high: price,
            low: price,
            open: price,
            close: price,
            volume: size,
            date,
            timestamp,
            minute,
          };
          currentCandle$.next(currentCandle);
          currentMinute$.next(minute);
        } else {
          if (currentCandle.minute !== minute) {
            // minute gets iterated before candle
            // This lets buildSyncedCandles know to push the candle before it ticks over
            currentMinute$.next(minute);
            currentCandle = {
              high: price,
              low: price,
              open: price,
              close: price,
              volume: size,
              date,
              timestamp,
              minute,
            };
            currentCandle$.next(currentCandle);
          } else {
            const { high, low, open, volume } = currentCandle;

            currentCandle = {
              high: price.gt(high) ? price : high,
              low: price.lt(low) ? price : low,
              open,
              close: price,
              volume: volume.plus(size),
              date,
              timestamp,
              minute,
            };
            currentCandle$.next(currentCandle);
          }
        }
      };

      // Check for continuity and process history, then resolve
      this.feedSvc
        .checkTradeStreamContinuity(historicalTrades, tradeStream$)
        .then((isContinuous) => {
          if (!isContinuous) {
            // alert and abort for now, but abort and retry if this becomes an issue
            alert('Trade stream not continuous. Aborting.');
            reject('Trade stream not continuous');
          } else {
            console.log('trade stream is continuous. Processing history');
            for (let trade of historicalTrades) {
              addTrade(trade);
            }
            resolve({ currentCandle$, currentMinute$ });
          }
        });

      tradeStream$.subscribe((trade) => {
        addTrade(trade);
      });
    });
  };

  buildSyncedCandles = async (
    productId: string,
    candleStream$: Subject<Candle>,
    currentMinute$: BehaviorSubject<number>,
    maxCandles?: number
  ) => {
    const syncUp = () =>
      new Promise<CandleHistory>((resolve, reject) => {
        const tryIt = async () => {
          try {
            console.log('trying to sync up');
            const candles = await this.feedSvc.getCbCandles({
              productId,
              granularity: 60, // may not hard-code this
            });
            candles.reverse();
            const lastCandle = candles.pop();
            if (lastCandle?.minute !== currentMinute$.value) {
              console.log('not synced up yet');
              setTimeout(tryIt, 350); // may not hard-code this delay either
            } else {
              console.log('synced up');
              resolve(new CandleHistory(productId, maxCandles, candles));
            }
          } catch (error) {
            reject(error);
          }
        };
        tryIt();
      });

    const candleHistory = await syncUp();

    combineLatest([candleStream$, currentMinute$]).subscribe(
      ([candle, minute]) => {
        // In theory, candle.minute ticks over before minute does
        // Maybe a little hacky, but it works
        if (minute !== candle.minute) {
          candleHistory.append(candle);
        }
      }
    );

    return candleHistory;
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
  sma?: Big;
  bb?: BandsResult;
};

// This could take on more of the synced candle building logic internally
export class CandleHistory {
  lastCandle$ = new Subject<Candle>();
  maxCandles: number = 10000;
  candles: Candle[] = [];
  productId: string;

  constructor(
    productId: string,
    maxCandles?: number,
    initialCandles?: Candle[]
  ) {
    this.productId = productId;
    if (maxCandles) {
      this.maxCandles = maxCandles;
    }
    if (initialCandles) {
      this.candles = initialCandles;
    }
  }

  append = (candle: Candle) => {
    this.lastCandle$.next(candle);
    this.candles.push(candle);
    if (this.candles.length > this.maxCandles) {
      this.candles.shift();
    }
  };

  // Mainly here for display purposes
  reversedCandles = () => this.candles.slice().reverse();
}
