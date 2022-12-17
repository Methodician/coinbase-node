import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { FasterBandsResult } from 'trading-signals';
import { Candle, CandleHistory, CandleService } from './candle.service';
import { CbFeedService } from './cb-feed.service';
import {
  BbGenerator,
  FastBbGenerator,
  FastSmaGenerator,
  PriceHistory,
  SignalService,
  SmaGenerator,
} from './signal.service';

@Injectable({
  providedIn: 'root',
})
export class AggregatorService {
  constructor(
    private feedSvc: CbFeedService,
    private candleSvc: CandleService,
    private signalSvc: SignalService
  ) {}

  trackCandleSma = (sma: SmaGenerator, history: CandleHistory) => {
    history.lastCandle$.subscribe((candle) => {
      if (candle) {
        this.signalSvc.updateSmaAndAddToCandle(sma, candle);
      }
    });
  };

  trackCandleBb = (bb: BbGenerator, history: CandleHistory) => {
    history.lastCandle$.subscribe((candle) => {
      if (candle) {
        this.signalSvc.updateBbAndAddToCandle(bb, candle);
      }
    });
  };

  initializeFeeds = async (productId: string) => {
    const { transferFeed } = await this.feedSvc.getLinearTrades(productId, 200);
    const { historicalTrades, tradeStream$ } = await transferFeed();
    const { currentCandle$, currentMinute$ } =
      await this.candleSvc.buildCandleStream(historicalTrades, tradeStream$);
    const prices: PriceHistory = new PriceHistory(productId);

    const smaGenerator = new SmaGenerator(7, productId);
    const bbGenerator = new BbGenerator(20, 2, productId);

    const candleHistory = await this.candleSvc.buildSyncedCandles(
      productId,
      currentCandle$,
      currentMinute$
    );

    candleHistory.candles.forEach((candle) => {
      this.signalSvc.updateSmaAndAddToCandle(smaGenerator, candle);
      this.signalSvc.updateBbAndAddToCandle(bbGenerator, candle);
      prices.append(Number(candle.close.toString()));
    });

    candleHistory.lastCandle$.subscribe((candle) => {
      if (candle) {
        prices.append(Number(candle.close.toString()));
      }
    });

    this.trackCandleSma(smaGenerator, candleHistory);
    this.trackCandleBb(bbGenerator, candleHistory);

    const stream = new SignalStream(
      productId,
      currentCandle$,
      currentMinute$,
      prices
    );

    return {
      productId,
      candleHistory,
      stream,
      prices,
    };
  };
}

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
    this.bbGenerator = new FastBbGenerator(bbInterval, bbDeviation, productId);

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
