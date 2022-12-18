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
import { Candle } from '../models';

// organize these
export class SignalStream {
  candle$: Subject<Candle>;
  minute$: Subject<number>;
  sma$ = new Subject<number>();
  bb$ = new Subject<FasterBandsResult>();
  price$ = new Subject<number>();
  private ph: PriceHistory;
  private bbGenerator: FastBbGenerator;
  private smaGenerator: FastSmaGenerator;

  constructor(
    productId: string,
    candle$: Subject<Candle>,
    minute$: Subject<number>,
    prices: PriceHistory,
    smaInterval: number = 7,
    bbInterval: number = 20,
    bbDeviation: number = 2
  ) {
    this.candle$ = candle$;
    this.minute$ = minute$;
    this.ph = prices;

    this.smaGenerator = new FastSmaGenerator(smaInterval, productId);
    this.bbGenerator = new FastBbGenerator(productId, bbInterval, bbDeviation);

    this.smaGenerator.sma$.subscribe((sma) => {
      this.sma$.next(sma);
    });
    this.bbGenerator.bb$.subscribe((bb) => {
      this.bb$.next(bb);
    });

    this.candle$.subscribe((candle) => {
      const recentPrices = this.ph.prices.slice(-bbInterval);
      recentPrices.push(Number(candle.close.toString()));
      this.smaGenerator.reCalculate(recentPrices);
      this.bbGenerator.reCalculate(recentPrices);
    });
  }
}

export class PriceHistory {
  readonly maxHistory: number = 100;
  readonly prices: number[] = [];
  readonly currentPrice$ = new Subject<number>();
  readonly productId: string;

  constructor(productId: string, maxHistory?: number, prevHistory?: number[]) {
    this.productId = productId;
    if (maxHistory) this.maxHistory = maxHistory;
    if (prevHistory) {
      this.prices = prevHistory.slice(-this.maxHistory);
      this.currentPrice$.next(prevHistory[prevHistory.length - 1]);
    }
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
  private sma: SMA;
  readonly interval: number;
  private priceCount: number = 0;
  readonly sma$ = new Subject<Big>();
  readonly productId: string;

  constructor(interval: number, productId: string) {
    this.productId = productId;

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
  private sma: FasterSMA;
  readonly interval: number;
  private priceCount: number = 0;
  readonly sma$ = new Subject<number>();
  readonly productId: string;

  constructor(interval: number, productId: string) {
    this.productId = productId;

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
  private bb: BollingerBands;
  readonly interval: number;
  private priceCount: number = 0;
  readonly deviationMultiplier?: number;
  readonly bb$ = new Subject<BandsResult>();
  readonly productId: string;

  constructor(
    productId: string,
    interval: number,
    deviationMultiplier?: number
  ) {
    this.productId = productId;
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
  private bb: FasterBollingerBands;
  readonly interval: number;
  private priceCount: number = 0;
  readonly deviationMultiplier?: number;
  readonly bb$ = new Subject<FasterBandsResult>();
  readonly productId: string;

  constructor(
    productId: string,
    interval: number,
    deviationMultiplier?: number
  ) {
    if (deviationMultiplier) this.deviationMultiplier = deviationMultiplier;

    this.productId = productId;
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

// This could take on more of the synced candle building logic internally
export class CandleHistory {
  readonly lastCandle$ = new Subject<Candle>();
  readonly maxCandles: number = 10000;
  readonly candles: Candle[] = [];
  readonly productId: string;

  constructor(
    productId: string,
    maxCandles?: number,
    initialCandles?: Candle[]
  ) {
    this.productId = productId;
    if (maxCandles) {
      this.maxCandles = maxCandles;
    }
    if (initialCandles) {
      this.candles = initialCandles;
    }
  }

  append = (candle: Candle) => {
    this.lastCandle$.next(candle);
    this.candles.push(candle);
    if (this.candles.length > this.maxCandles) {
      this.candles.shift();
    }
  };

  // Mainly here for display purposes
  reversedCandles = () => this.candles.slice().reverse();
}
