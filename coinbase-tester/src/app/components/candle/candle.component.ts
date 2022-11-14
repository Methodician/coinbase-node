import { Component, OnInit } from '@angular/core';
import { Candle, CandleService } from 'src/app/services/candle.service';

@Component({
  selector: 'app-candle',
  templateUrl: './candle.component.html',
  styleUrls: ['./candle.component.scss'],
})
export class CandleComponent implements OnInit {
  pastCandles = this.candleSvc.pastCandles;
  currentCandle = () => this.candleSvc.currentCandle;

  constructor(private candleSvc: CandleService) {
    this.candleSvc.buildCandles('ETH-USD');
  }

  ngOnInit(): void {}
}
