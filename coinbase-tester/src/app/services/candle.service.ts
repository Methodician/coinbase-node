import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { CbFeedService, MergedTrade } from './cb-feed.service';
import { CbRestService } from './cb-rest.service';
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
    // Maybe doesn't need to be observable (see comment in CandleComponent.initializeCandles)
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
    currentMinute$: BehaviorSubject<number>,
    maxCandles?: number
  ) => {
    const syncUp = () =>
      new Promise<CandleHistory>((resolve, reject) => {
        const recurse = async () => {
          try {
            console.log('syncing up');
            const candles = await this.getRestCandles(productId);
            candles.reverse();
            const poppedCandle = candles.pop();
            if (poppedCandle?.minute !== currentMinute$.value) {
              setTimeout(recurse, 350);
            } else {
              resolve(new CandleHistory(productId, maxCandles, candles));
            }
          } catch (error) {
            reject(error);
          }
        };
        recurse();
      });

    const candles = await syncUp();

    combineLatest([candleStream$, currentMinute$]).subscribe(
      ([candle, minute]) => {
        // Feels a little hacky and redundant but not sure maybe great
        // See comment in this.buildCandleStream
        if (minute !== candle.minute) {
          candles.append(candle);
        }
      }
    );

    return candles;
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
  currentCandle$ = new BehaviorSubject<Candle | null>(null);
  maxCandles: number = 10000;
  candles: Candle[] = [];
  productId: string = 'UNSET';

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
    this.currentCandle$.next(candle);
    this.candles.push(candle);
    if (this.candles.length > this.maxCandles) {
      this.candles.shift();
    }
  };

  // Mainly here for display purposes
  reversedCandles = () => this.candles.slice().reverse();
}
