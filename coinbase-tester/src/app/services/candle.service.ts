import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { Candle, MergedTrade } from '../models';
import { CandleHistory } from '../rename-me';
import { CbFeedService } from './cb-feed.service';

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
            open: price,
            high: price,
            low: price,
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
              open: price,
              high: price,
              low: price,
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
              open,
              high: price.gt(high) ? price : high,
              low: price.lt(low) ? price : low,
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
}
