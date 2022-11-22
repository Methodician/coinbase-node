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
  socketCandles = () => this.candleSvc.candles;
  restCandles: any[] = [];
  allCandles = () => this.candleSvc.syncedCandles;

  constructor(private candleSvc: CandleService) {
    this.initializeCandles();
    this.getCandles();

    this.candleSvc.currentMinute$
      .pipe(debounceTime(1000))
      .subscribe((minute) => {
        console.log({ minute });
        this.getCandles();
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
}
