import { Injectable } from '@angular/core';
import { Candle } from '../models';
import { BbGenerator, SmaGenerator } from '../rename-me';

@Injectable({
  providedIn: 'root',
})
export class SignalService {
  constructor() {}

  updateSmaAndAddToCandle = (sma: SmaGenerator, candle: Candle) => {
    try {
      const ma = sma.update(candle.close);
      if (ma !== undefined) {
        candle.sma = ma;
      }
    } catch (error) {
      // May actually want to throw sometimes
      console.error(error);
    }
  };

  updateBbAndAddToCandle = (bb: BbGenerator, candle: Candle) => {
    try {
      const bol = bb.update(candle.close);
      if (bol !== undefined) {
        candle.bb = bol;
      }
    } catch (error) {
      // May actually want to throw sometimes
      console.error(error);
    }
  };
}
