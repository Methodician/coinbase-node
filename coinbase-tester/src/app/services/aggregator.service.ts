import { Injectable } from '@angular/core';

import {
  BbGenerator,
  CandleHistory,
  PriceHistory,
  SignalStream,
  SmaGenerator,
} from '../rename-me';
import { CandleService } from './candle.service';
import { CbFeedService } from './cb-feed.service';
import { SignalService } from './signal.service';

@Injectable({
  providedIn: 'root',
})
export class AggregatorService {
  // One of the key reasons for this service is to avoid circular dependencies

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
    const bbGenerator = new BbGenerator(productId, 20, 2);

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
