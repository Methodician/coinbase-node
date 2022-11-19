import { Injectable } from '@angular/core';
import axios from 'axios';
import { MergedTrade } from './cb-feed.service';
const EXCHANGE_URL = 'https://api.exchange.coinbase.com';

@Injectable({
  providedIn: 'root',
})
export class CbRestService {
  constructor() {}

  getProductTrades = async (args: GetProductTradesArgs) => {
    console.log('getProductTrades', args);
    const { productId, after, before, limit } = args;
    let url = `https://api.exchange.coinbase.com/products/${productId}/trades`;
    let paramSeparator = '?';
    // console.log(url);
    if (after) {
      url += `${paramSeparator}after=${after}`;
      paramSeparator = '&';
    }
    // console.log(url);
    if (before) {
      url += `${paramSeparator}before=${before}`;
      paramSeparator = '&';
    }
    // console.log(url);
    if (limit) {
      url += `${paramSeparator}limit=${limit}`;
      paramSeparator = '&';
    }
    // console.log(url);

    const options = {
      method: 'GET',
      url,
      headers: { accept: 'application/json' },
    };

    try {
      const res = await axios.request<RestResponseTrade[]>(options);
      return res.data;
    } catch (error) {
      logError(error);
      return [];
    }
  };

  getProductCandles = async (args: GetProductCandlesArgs) => {
    let url = `${EXCHANGE_URL}/products/${args.productId}/candles`;
    let paramSeparator = '?';

    if (args.granularity) {
      url += `${paramSeparator}granularity=${args.granularity}`;
      paramSeparator = '&';
    }

    if (args.startAndEnd) {
      url += `${paramSeparator}start=${args.startAndEnd.start.toISOString()}&end=${args.startAndEnd.end.toISOString()}`;
    }

    const options = {
      method: 'GET',
      url,
      headers: { accept: 'application/json' },
    };

    try {
      const res = await axios.request(options);
      return res.data;
    } catch (error: any) {
      logError(error);
    }
  };

  processTrades = (
    trades: RestResponseTrade[],
    productId: string
  ): MergedTrade[] =>
    trades.map(({ price, size, time, trade_id, side }) => ({
      price: Number(price),
      size: Number(size),
      date: new Date(time),
      // Interesting note: buy is a downtick and sell is an uptick.
      // Intuitive when you pause. It's maker side.
      // When buyer is taker, they taking the below-market price
      // When seller is taker, they taking the above-market price
      side: side === 'buy' ? 'buy' : 'sell',
      tradeId: trade_id,
      productId,
    }));
}

const logError = (error: any) => {
  if (!error.code && !error.response.data) {
    console.error('Request Error: ', error);
  }
  console.error('Request Error: ', error.code, error.response.data);
};
// CandleGranularity can be one minute, five minutes, fifteen minutes, one hour, six hours, or one day.
type CandleGranularity = 60 | 300 | 900 | 3600 | 21600 | 86400;
// If either is not provided both will be ignore, so only allow both or neither
type StartAndEnd = {
  start: Date;
  end: Date;
};

// shared types
export type GetProductCandlesArgs = {
  productId: string;
  granularity?: CandleGranularity;
  startAndEnd?: StartAndEnd;
};

export type GetProductTradesArgs = {
  productId: string;
  limit?: number;
  before?: number;
  after?: number;
};

export type RestResponseTrade = {
  time: string; // '2022-10-01T22:07:58.060191Z';
  trade_id: number; // 363539038;
  price: string; // '1315.26000000';
  size: string; // '0.00283594';
  side: 'buy' | 'sell'; // 'buy';
};
