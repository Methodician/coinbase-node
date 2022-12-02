import { Injectable } from '@angular/core';
import Big from 'big.js';
import { FasterBollingerBands, FasterSMA, SMA } from 'trading-signals';
import { Candle } from './candle.service';

@Injectable({
  providedIn: 'root',
})
export class SignalService {
  constructor() {}

  /**
   *
   * @param price updates using "number" instead of "BigNumber"
   * @param history length represents length of history
   * @returns reference to the history object passed in
   */
  addFastClosingPrice = (price: number, history: PriceHistory) => {
    const { prices, length } = history;
    if (prices.length === length) {
      prices.shift();
    }
    prices.push(price);
    return history;
  };

  /**
   * This generates a new SMA from the last few elements in
   * a set of closing prices (interval determines number of elements)
   * @param history price history on which to base the SMA
   * @param interval optional interval to use for the SMA defaults to 7
   * @returns SMA result as number
   */
  createFastSmaResult = (history: PriceHistory, interval = 7) => {
    const { prices } = history;
    if (prices.length < interval) {
      return;
    }

    const sma = new FasterSMA(interval);
    for (let i = prices.length - 1 - interval; i < prices.length; i++) {
      sma.update(prices[i]);
    }

    return sma.getResult();
  };

  /**
   *
   * @param history price history on which to base the BB
   * @param interval optional interval fore the BB
   * @param deviationMultiplier optional multiplier for the BB
   * @returns BB results as object
   */
  createFastBbResult = (
    history: PriceHistory,
    interval = 20,
    deviationMultiplier = 2
  ) => {
    const { prices } = history;
    if (prices.length < interval) {
      return;
    }

    const bb = new FasterBollingerBands(interval, deviationMultiplier);
    for (let i = prices.length - 1 - interval; i < prices.length; i++) {
      bb.update(prices[i]);
    }

    return bb.getResult();
  };

  createSma = (interval: number) => new SMA(interval);

  addSmaToCandle = (sma: SMA, candle: Candle) => {
    // in theory should be able to just use candle.close
    // For some reason Big internal to trading-signals is not the same as Big.js
    sma.update(candle.close.toString());
    // trycatch to avoid erroring out with notEnoughData
    const ma = sma.getResult();
    // Like above, in theory the types of ma and candle.ma should be compatible
    candle.ma = new Big(ma.toString());
  };
}

export type PriceHistory = {
  length: number;
  prices: number[];
};
