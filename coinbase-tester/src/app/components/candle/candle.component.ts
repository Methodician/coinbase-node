import { Component } from '@angular/core';
import { CandleHistory, SignalStream } from 'src/app/rename-me';
import { logCandle } from 'src/app/rename-me/helpers';
import { AggregatorService } from 'src/app/services/aggregator.service';
import { CandleService } from 'src/app/services/candle.service';
import { CbFeedService } from 'src/app/services/cb-feed.service';

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
    private cbFeedSvc: CbFeedService,
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
    const { candleHistory } = this;
    if (candleHistory === undefined) {
      throw new Error('No candle history');
    }

    const { lastCandle$, productId, reversedCandles } = candleHistory;

    lastCandle$.subscribe(async () => {
      const restCandles = await this.cbFeedSvc.getCbCandles({
        productId,
        granularity: 60,
      });
      const syncedCandles = reversedCandles() || [];

      for (let [i, v] of restCandles.entries()) {
        const r = v;
        const s = syncedCandles[i];
        if (r?.minute !== s?.minute) {
          console.log('r.minute !== s.minute');
          logCandle(r);
          logCandle(s);
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
          logCandle(r);
          console.log('internal:');
          logCandle(s);
        }
      }
    });
  };
}
