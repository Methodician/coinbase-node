import { Component } from '@angular/core';
import { BehaviorSubject, debounceTime } from 'rxjs';
import {
  Candle,
  CandleHistory,
  CandleService,
} from 'src/app/services/candle.service';
import { CbFeedService } from 'src/app/services/cb-feed.service';
import {
  BbGenerator,
  FastBbGenerator,
  FastSmaGenerator,
  PriceHistory,
  SignalService,
  SmaGenerator,
} from 'src/app/services/signal.service';

@Component({
  selector: 'app-candle',
  templateUrl: './candle.component.html',
  styleUrls: ['./candle.component.scss'],
})
export class CandleComponent {
  restCandles: Candle[] = [];
  candleHistory?: CandleHistory;
  currentCandle$ = new BehaviorSubject<Candle | undefined>(undefined);
  // Maybe make one for the minute-by-minute candles?
  fastPriceHistory = new PriceHistory('ETH-USD', 100);

  currentBb = new FastBbGenerator(20, 2);
  currentSma = new FastSmaGenerator(7);

  // todo: organize the stuff into other services and components (and/or begin migration to node?)

  constructor(
    private feedSvc: CbFeedService,
    private candleSvc: CandleService,
    private signalSvc: SignalService
  ) {
    this.initializeCandles().then(() => {
      this.watchCurrentCandle();
    });

    this.fastPriceHistory.currentPrice$.subscribe((price) => {
      this.currentSma.update(price);
      this.currentBb.update(price);
    });
  }

  // Seems a little odd to take them as arguments but maybe that's just because
  // so far I've been tracking things globally. This could lend to composablity
  // Maybe what I really want is to track all the things for a given productId
  watchCandleHistory = (sma: SmaGenerator, bb: BbGenerator) => {
    if (!this.candleHistory) {
      throw new Error('candle history not initialized');
    }

    this.candleHistory.currentCandle$.subscribe((candle) => {
      if (candle) {
        this.signalSvc.updateSmaAndAddToCandle(sma, candle);
        this.signalSvc.updateBbAndAddToCandle(bb, candle);
      }
    });
  };

  watchCurrentCandle = () => {
    this.currentCandle$.subscribe((candle) => {
      if (candle) {
        this.fastPriceHistory.append(Number(candle.close.toString()));
      }
    });
  };

  // This is turning into more than a candle initializer.
  // I may want to build a full-sweep initializer for a given productId
  // This may end up in another service, although that structure may not map 1:1 with my eventual server code
  initializeCandles = async () => {
    const { currentCandle$, currentMinute$, wasTradeHistoryProcessed$ } =
      await this.buildCandleStreams('ETH-USD');

    this.currentCandle$ = currentCandle$;
    const smaGenerator = new SmaGenerator(7, 'ETH-USD');
    const bbGenerator = new BbGenerator(20, 2, 'ETH-USD');

    // Yeah doesn't seem like this needs to be observable
    wasTradeHistoryProcessed$.subscribe((wasProcessed) => {
      if (wasProcessed) {
        this.candleSvc
          .buildSyncedCandles(
            'ETH-USD',
            currentCandle$ as BehaviorSubject<Candle>,
            currentMinute$
          )
          .then((history) => {
            history.candles.forEach((candle) => {
              this.signalSvc.updateSmaAndAddToCandle(smaGenerator, candle);
              this.signalSvc.updateBbAndAddToCandle(bbGenerator, candle);
            });
            this.candleHistory = history;
            this.watchCandleHistory(smaGenerator, bbGenerator);
          });
      }
    });

    // Temporary until I am convinced we get the same results always
    currentMinute$.pipe(debounceTime(1000)).subscribe((minute) => {
      console.log('checking for discrepancies at minute', minute);
      this.getCandles().then(() => {
        this.checkRestSyncDiscrepancies();
      });
    });
  };

  buildCandleStreams = async (productId: string) => {
    const { transferFeed } = await this.feedSvc.getLinearTrades(productId, 200);
    const { historicalTrades, tradeStream$ } = transferFeed();
    const { currentCandle$, currentMinute$, wasTradeHistoryProcessed$ } =
      this.candleSvc.buildCandleStream(historicalTrades, tradeStream$);

    return {
      currentCandle$,
      currentMinute$,
      wasTradeHistoryProcessed$,
    };
  };

  // likely going to drop this once I'm convinced (along with the REST candles)
  getCandles = async () => {
    const candles = await this.candleSvc.getRestCandles('ETH-USD');
    this.restCandles = candles;
  };

  checkRestSyncDiscrepancies = () => {
    const restCandles = this.restCandles;
    const syncedCandles = this.candleHistory?.reversedCandles() || [];
    for (let [i, v] of restCandles.entries()) {
      const r = v;
      const s = syncedCandles[i];
      if (r?.minute !== s?.minute) {
        console.log('r.minute !== s.minute');
        this.candleSvc.logCandle(r);
        this.candleSvc.logCandle(s);
        return;
      }
      const discrepantElements = [];
      if (r.high.toString() !== s.high.toString()) {
        discrepantElements.push('high');
      }
      if (r.low.toString() !== s.low.toString()) {
        discrepantElements.push('low');
      }
      if (r.open.toString() !== s.open.toString()) {
        discrepantElements.push('open');
      }
      if (r.close.toString() !== s.close.toString()) {
        discrepantElements.push('close');
      }
      if (r.volume.toString() !== s.volume.toString()) {
        discrepantElements.push('volume');
      }
      if (discrepantElements.length) {
        console.log('discrepantElements', discrepantElements);
        this.candleSvc.logCandle(r);
        this.candleSvc.logCandle(s);
      }
    }
  };
}
