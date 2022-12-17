import { Component } from '@angular/core';
import {
  AggregatorService,
  SignalStream,
} from 'src/app/services/aggregator.service';
import { CandleHistory, CandleService } from 'src/app/services/candle.service';

@Component({
  selector: 'app-candle',
  templateUrl: './candle.component.html',
  styleUrls: ['./candle.component.scss'],
})
export class CandleComponent {
  candleHistory?: CandleHistory;
  signalStream?: SignalStream;

  // todo: organize the stuff into other services and components (and/or begin migration to node?)

  constructor(
    private aggSvc: AggregatorService,
    private candleSvc: CandleService
  ) {
    this.aggSvc
      .initializeFeeds('ETH-USD')
      .then(({ candleHistory: history, stream, prices }) => {
        this.candleHistory = history;
        this.signalStream = stream;

        this.watchForRestSyncDiscrepancies();
      });
  }

  // Likely to drop once I'm convinced
  watchForRestSyncDiscrepancies = () => {
    // I'm seeing a new pattern where the first minute processed is discrepant from the server
    // So far rarely if ever seeing further discrepancies, although it doesn't match the CB advanced trade UI
    console.log('Watching for discrepancies with server...');
    const { candleHistory: history } = this;
    if (history === undefined) {
      throw new Error('No candle history');
    }

    history.lastCandle$.subscribe(async () => {
      const restCandles = await this.candleSvc.getRestCandles(
        history.productId
      );
      const syncedCandles = history.reversedCandles() || [];

      for (let [i, v] of restCandles.entries()) {
        const r = v;
        const s = syncedCandles[i];
        if (r?.minute !== s?.minute) {
          console.log('r.minute !== s.minute');
          this.candleSvc.logCandle(r);
          this.candleSvc.logCandle(s);
          // Comparison not valid so don't waste processing
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
          console.log('minute', r.minute);
          console.log('cb server:');
          this.candleSvc.logCandle(r);
          console.log('internal:');
          this.candleSvc.logCandle(s);
        }
      }
    });
  };
}
