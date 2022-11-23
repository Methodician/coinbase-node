import { Component } from '@angular/core';
import { BehaviorSubject, debounceTime } from 'rxjs';
import { Candle, CandleService } from 'src/app/services/candle.service';
import { CbFeedService } from 'src/app/services/cb-feed.service';
import { SignalService } from 'src/app/services/signal.service';

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

  // todo: organize the stuff into other services and components (and/or begin migration to node?)

  // feed stuff

  // sma stuff
  sma = this.signalSvc.createSma(5);

  constructor(
    private feedSvc: CbFeedService,
    private candleSvc: CandleService,
    private signalSvc: SignalService
  ) {
    // feed stuff
    this.initializeCandles();

    // sma stuff
  }

  initializeCandles = async () => {
    const { currentCandle$, currentMinute$, wasTradeHistoryProcessed$ } =
      await this.buildStreams('ETH-USD');

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

    currentMinute$.pipe(debounceTime(1000)).subscribe((minute) => {
      console.log('checking for discrepancies at minute', minute);
      this.getCandles().then(() => {
        this.checkRestSyncDiscrepancies();
      });
    });
  };

  buildStreams = async (productId: string) => {
    const { transferFeed } = await this.feedSvc.getLinearTrades(productId, 200);
    const { historicalTrades, tradeStream$ } = transferFeed();
    const { currentCandle$, currentMinute$, wasTradeHistoryProcessed$ } =
      this.candleSvc.buildCandleStream(historicalTrades, tradeStream$);

    return { currentCandle$, currentMinute$, wasTradeHistoryProcessed$ };
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
