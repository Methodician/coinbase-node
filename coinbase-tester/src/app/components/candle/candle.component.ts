import { Component, OnInit } from '@angular/core';
import { Candle, CandleService } from 'src/app/services/candle.service';

@Component({
  selector: 'app-candle',
  templateUrl: './candle.component.html',
  styleUrls: ['./candle.component.scss'],
})
export class CandleComponent implements OnInit {
  pastCandles = this.candleSvc.candles;

  constructor(private candleSvc: CandleService) {
    this.candleSvc.buildInitialCandles('ETH-USD');
  }

  ngOnInit(): void {}
}
