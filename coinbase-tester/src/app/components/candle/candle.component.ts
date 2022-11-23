import { Component, OnInit } from '@angular/core';
import { debounceTime } from 'rxjs';
import { Candle, CandleService } from 'src/app/services/candle.service';

@Component({
  selector: 'app-candle',
  templateUrl: './candle.component.html',
  styleUrls: ['./candle.component.scss'],
})
export class CandleComponent implements OnInit {
  earlierCandles: Candle[] = [];
  // Purely for display so just creating a new one to reverse it
  socketCandles = () => [...this.candleSvc.candles].reverse();
  restCandles: Candle[] = [];
  syncedCandles = () => [...this.candleSvc.syncedCandles].reverse();
  currentCandle = () => this.candleSvc.currentCandle ?? {};

  constructor(private candleSvc: CandleService) {
    this.initializeCandles();
    this.getCandles();

    this.candleSvc.currentMinute$
      .pipe(debounceTime(1000))
      .subscribe((minute) => {
        console.log({ minute });
        this.getCandles().then(() => {
          this.checkRestSyncDiscrepancies();
        });
      });
  }

  ngOnInit(): void {}

  getCandles = async () => {
    const candles = await this.candleSvc.getRestCandles('ETH-USD');
    this.restCandles = candles;
  };

  initializeCandles = async () => {
    await this.candleSvc.buildInitialCandles('ETH-USD');
  };

  // likely going to drop this once I'm convinced (along with the REST candles)
  checkRestSyncDiscrepancies = () => {
    const restCandles = this.restCandles;
    const syncedCandles = this.syncedCandles();
    console.log('checking discrepancies');
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
