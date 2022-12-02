import { Component } from '@angular/core';
import { BehaviorSubject, debounceTime, Subject } from 'rxjs';
import { Candle, CandleService } from 'src/app/services/candle.service';
import { CbFeedService } from 'src/app/services/cb-feed.service';
import { PriceHistory, SignalService } from 'src/app/services/signal.service';

@Component({
  selector: 'app-candle',
  templateUrl: './candle.component.html',
  styleUrls: ['./candle.component.scss'],
})
export class CandleComponent {
  restCandles: Candle[] = [];
  syncedCandles: Candle[] = [];
  reversedCandles = () => [...this.syncedCandles].reverse();
  currentCandle$ = new BehaviorSubject<Candle | undefined>(undefined);
  priceHistory: PriceHistory = {
    length: 40,
    prices: [],
  };

  // May want to use "faster" implementations for these guys since they are deeply cloned.
  // Alternatively, maybe this process is a code smell
  // Maybe these should not be made, or a different library should be used...
  // Or maybe that's all premature optimization...
  currentBb$ = new Subject<{
    upper: number;
    middle: number;
    lower: number;
  }>();
  currentSma$ = new Subject<number>();

  // todo: organize the stuff into other services and components (and/or begin migration to node?)

  // feed stuff

  // sma stuff

  constructor(
    private feedSvc: CbFeedService,
    private candleSvc: CandleService,
    private signalSvc: SignalService
  ) {
    this.initializeCandles().then(() => {
      this.watchCurrentCandle();
    });

    // sma stuff
  }

  watchCurrentCandle = () => {
    this.currentCandle$.subscribe((candle) => {
      if (candle) {
        const history = this.signalSvc.addFastClosingPrice(
          Number(candle.close.toString()),
          this.priceHistory
        );
        // These repeat a lot at the start I think while history is processed...
        // Could optimize later
        const sma = this.signalSvc.createFastSmaResult(history);
        if (sma) {
          this.currentSma$.next(sma);
        }
        const bb = this.signalSvc.createFastBbResult(history);
        if (bb) {
          this.currentBb$.next(bb);
        }
      }
    });
  };

  // This is turning into more than a candle initializer.
  initializeCandles = async () => {
    const { currentCandle$, currentMinute$, wasTradeHistoryProcessed$ } =
      await this.buildCandleStreams('ETH-USD');

    this.currentCandle$ = currentCandle$;

    wasTradeHistoryProcessed$.subscribe((wasProcessed) => {
      if (wasProcessed) {
        this.candleSvc
          .buildSyncedCandles(
            'ETH-USD',
            currentCandle$ as BehaviorSubject<Candle>,
            currentMinute$
          )
          .then((candles) => {
            this.syncedCandles = candles;
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
    const syncedCandles = this.reversedCandles();
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
