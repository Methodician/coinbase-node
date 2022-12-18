// organize these

import Big from 'big.js';
import { BandsResult } from 'trading-signals';

// Thinking I should leave the candle type alone and add a new type called "tick" or something
// That could contain a candle as well as some signals
export type Candle = {
  high: Big;
  low: Big;
  open: Big;
  close: Big;
  volume: Big;
  timestamp: number;
  date: Date;
  minute: number;
  sma?: Big;
  bb?: BandsResult;
};

export type MergedTrade = {
  price: Big;
  size: Big;
  date: Date;
  side: 'buy' | 'sell';
  tradeId: number;
  productId: string;
};
