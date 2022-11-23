import { Injectable } from '@angular/core';
import { SMA } from 'trading-signals';

@Injectable({
  providedIn: 'root',
})
export class SignalService {
  constructor() {}

  createSma = (period: number) => {
    return new SMA(period);
  };

  updateSma = (sma: SMA, value: number) => {
    sma.update(value);
  };

  getSma = (sma: SMA) => {
    return sma.getResult();
  };
}
