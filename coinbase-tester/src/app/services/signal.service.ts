import { Injectable } from '@angular/core';
import Big, { BigSource } from 'big.js';
import { Subject } from 'rxjs';
import {
  BandsResult,
  BollingerBands,
  FasterBandsResult,
  FasterBollingerBands,
  FasterSMA,
  SMA,
} from 'trading-signals';
import { Candle } from './candle.service';

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

// These can go in their own files
export class PriceHistory {
  maxHistory: number = 100;
  prices: number[] = [];
  currentPrice$ = new Subject<number>();
  productId: string = 'UNSET';

  constructor(productId: string, maxHistory?: number) {
    this.productId = productId;
    if (maxHistory) this.maxHistory = maxHistory;
  }

  append = (price: number) => {
    this.prices.push(price);
    this.currentPrice$.next(price);
    if (this.prices.length > this.maxHistory) {
      this.prices.shift();
    }
  };
}

export class SmaGenerator {
  sma: SMA;
  interval: number;
  priceCount: number = 0;
  sma$ = new Subject<Big>();
  productId: string = 'UNSET';

  constructor(interval: number, productId?: string) {
    if (productId) this.productId = productId;

    this.sma = new SMA(interval);
    this.interval = interval;
  }

  update = (price: BigSource) => {
    this.sma.update(price);

    if (this.priceCount < this.interval) {
      this.priceCount++;
      return;
    }

    const res = this.sma.getResult();
    this.sma$.next(res);
    return res;
  };

  reCalculate = (priceHistory: BigSource[]) => {
    this.sma = new SMA(this.interval);
    this.priceCount = 0;
    for (
      let i = priceHistory.length - 1 - this.interval;
      i < priceHistory.length;
      i++
    ) {
      this.priceCount++;
      this.sma.update(priceHistory[i]);
    }

    if (this.priceCount < this.interval) {
      return;
    }

    const res = this.sma.getResult();
    this.sma$.next(res);
    return res;
  };
}

// May combine fast into basic one
export class FastSmaGenerator {
  sma: FasterSMA;
  interval: number;
  priceCount: number = 0;
  sma$ = new Subject<number>();
  productId: string = 'UNSET';

  constructor(interval: number, productId?: string) {
    if (productId) this.productId = productId;

    this.sma = new FasterSMA(interval);
    this.interval = interval;
  }

  update = (price: number) => {
    this.sma.update(price);

    if (this.priceCount < this.interval) {
      this.priceCount++;
      return;
    }

    const res = this.sma.getResult();
    this.sma$.next(res);
    return res;
  };

  reCalculate = (priceHistory: number[]) => {
    this.sma = new FasterSMA(this.interval);
    this.priceCount = 0;
    for (
      let i = priceHistory.length - 1 - this.interval;
      i < priceHistory.length;
      i++
    ) {
      this.priceCount++;
      this.sma.update(priceHistory[i]);
    }

    if (this.priceCount < this.interval) {
      return;
    }

    const res = this.sma.getResult();
    this.sma$.next(res);
    return res;
  };
}

export class BbGenerator {
  bb: BollingerBands;
  interval: number;
  priceCount: number = 0;
  deviationMultiplier?: number;
  bb$ = new Subject<BandsResult>();
  productId: string = 'UNSET';

  constructor(
    interval: number,
    deviationMultiplier?: number,
    productId?: string
  ) {
    if (productId) this.productId = productId;
    if (deviationMultiplier) this.deviationMultiplier = deviationMultiplier;

    this.bb = new BollingerBands(interval, deviationMultiplier);
    this.interval = interval;
  }

  update = (price: BigSource) => {
    this.bb.update(price);

    if (this.priceCount < this.interval) {
      this.priceCount++;
      return;
    }

    const res = this.bb.getResult();
    this.bb$.next(res);
    return res;
  };

  reCalculate = (priceHistory: BigSource[]) => {
    this.bb = new BollingerBands(this.interval, this.deviationMultiplier);
    this.priceCount = 0;
    for (
      let i = priceHistory.length - 1 - this.interval;
      i < priceHistory.length;
      i++
    ) {
      this.priceCount++;
      this.bb.update(priceHistory[i]);
    }

    if (this.priceCount < this.interval) {
      return;
    }

    const res = this.bb.getResult();
    this.bb$.next(res);
    return res;
  };
}

export class FastBbGenerator {
  bb: FasterBollingerBands;
  interval: number;
  priceCount: number = 0;
  deviationMultiplier?: number;
  bb$ = new Subject<FasterBandsResult>();
  productId: string = 'UNSET';

  constructor(
    interval: number,
    deviationMultiplier?: number,
    productId?: string
  ) {
    if (productId) this.productId = productId;
    if (deviationMultiplier) this.deviationMultiplier = deviationMultiplier;

    this.bb = new FasterBollingerBands(interval, deviationMultiplier);
    this.interval = interval;
  }

  update = (price: number) => {
    this.bb.update(price);

    if (this.priceCount < this.interval) {
      this.priceCount++;
      return;
    }

    const res = this.bb.getResult();
    this.bb$.next(res);
    return res;
  };

  reCalculate = (priceHistory: number[]) => {
    this.bb = new FasterBollingerBands(this.interval, this.deviationMultiplier);
    this.priceCount = 0;
    for (
      let i = priceHistory.length - 1 - this.interval;
      i < priceHistory.length;
      i++
    ) {
      this.priceCount++;
      this.bb.update(priceHistory[i]);
    }

    if (this.priceCount < this.interval) {
      return;
    }
    const res = this.bb.getResult();
    this.bb$.next(res);
    return res;
  };
}
