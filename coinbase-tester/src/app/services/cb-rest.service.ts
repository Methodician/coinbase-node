import { Injectable } from '@angular/core';
import axios from 'axios';
import { BehaviorSubject } from 'rxjs';
const EXCHANGE_URL = 'https://api.exchange.coinbase.com';

@Injectable({
  providedIn: 'root',
})
export class CbRestService {
  // wait why did I make these BehaviorSubjects?
  cbBefore$ = new BehaviorSubject<string>('');
  cbAfter$ = new BehaviorSubject<string>('');

  constructor() {}

  getEarlierProductTradesPage = async (productId: string) => {
    const before = this.cbBefore$.value;
    if (!before.length) {
      throw new Error(
        "cbBefore pagination value is not set. Can't get earlier trades"
      );
    }
    console.log({ before });
    return this.getProductTrades({ productId, before });
  };

  getLaterProductTradesPage = async (productId: string) => {
    const after = this.cbAfter$.value;
    if (!after.length) {
      throw new Error(
        "cbAfter pagination value is not set. Can't get later trades"
      );
    }
    console.log({ after });
    return this.getProductTrades({ productId, after });
  };

  getProductTrades = async (args: GetProductTradesArgs) => {
    const { productId, after, before, limit } = args;
    let url = `https://api.exchange.coinbase.com/products/${productId}/trades`;
    let paramSeparator = '?';
    if (after) {
      url += `${paramSeparator}after=${after}`;
      paramSeparator = '&';
    }
    if (before) {
      url += `${paramSeparator}before=${before}`;
      paramSeparator = '&';
    }
    if (limit) {
      url += `${paramSeparator}limit=${limit}`;
      paramSeparator = '&';
    }

    const options = {
      method: 'GET',
      url,
      headers: { accept: 'application/json' },
    };

    try {
      const res = await axios.request<RestResponseTrade[]>(options);
      const { data, headers } = res;
      const cbTrades = data;
      const cbBefore = headers['cb-before'];
      const cbAfter = headers['cb-after'];
      this.cbBefore$.next(cbBefore);
      this.cbAfter$.next(cbAfter);
      // may not need to return cbBefore and cbAfter
      return { cbTrades, cbBefore, cbAfter };
    } catch (error) {
      logError(error);
      return { cbTrades: [], cbBefore: null, cbAfter: null };
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
  // maybe these should only be strings
  before?: number | string;
  after?: number | string;
};

export type RestResponseTrade = {
  time: string; // '2022-10-01T22:07:58.060191Z';
  trade_id: number; // 363539038;
  price: string; // '1315.26000000';
  size: string; // '0.00283594';
  side: 'buy' | 'sell'; // 'buy';
};
