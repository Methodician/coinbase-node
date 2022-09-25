import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, Subject } from 'rxjs';
import { BollingerBands, NotEnoughDataError, SMA } from 'trading-signals';
import axios from 'axios';
const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';
const EXCHANGE_URL = 'https://api.exchange.coinbase.com';
const socket = new WebSocket(FEED_URL);

type Candle = {
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
  timestamp: number;
};

@Injectable({
  providedIn: 'root',
})
export class CbFeedService {
  private isSocketOpen$ = new BehaviorSubject(false);
  private lastSocketError$ = new Subject<any>();
  lastMessage$ = new Subject<any>();
  allTypes: Record<string, boolean> = {};

  snapshots: any[] = [];
  sma: SMA = new SMA(30);
  bollingerBands: BollingerBands = new BollingerBands(30, 2);

  currentMinute?: number;
  currentCandle: Candle = {
    high: 0,
    low: 0,
    open: 0,
    close: 0,
    volume: 0,
    timestamp: 0,
  };
  // Should be able to derive other candle intervals from this
  // todo: store in db (possibly in chunks or nested by day/hour/minute)
  // Could probably just grab candles from REST API instead of storing them
  // Then keep track of a relevant subset of candles in memory
  pastCandles: Candle[] = [];

  filled$ = this.lastMessage$.pipe(
    filter((msg) => msg.type === 'done' && msg.reason === 'filled')
  );

  constructor() {
    socket.onopen = () => {
      console.log('Marking socket as open');
      this.isSocketOpen$.next(true);
    };
    socket.onclose = () => {
      console.log('Marking socket as closed');
      this.isSocketOpen$.next(false);
    };
    socket.onmessage = (event) => {
      this.onSocketMessage(event);
    };
    socket.onerror = (error) => {
      console.log('Error ', (error as any).message);
      this.lastSocketError$.next(error);
    };

    this.filled$.subscribe((msg) => this.updateSMA(msg.price));

    this.start();
    this.processMatches();
  }

  processMatches = () => {
    this.lastMessage$
      .pipe(filter((msg) => msg.type === 'match'))
      .subscribe((match) => {
        let { price, time } = match;
        price = parseFloat(price);
        time = new Date(time);
        let timestamp = Math.round(time.getTime() / 60000) * 60000;
        const minute = time.getMinutes();
        if (this.currentMinute === undefined || this.currentMinute !== minute) {
          if (this.currentCandle.timestamp !== 0) {
            this.updateSMA(this.currentCandle.close);
            this.pastCandles.push(this.currentCandle);
          }
          this.currentMinute = minute;
          this.currentCandle = {
            high: price,
            low: price,
            open: price,
            close: price,
            volume: 0,
            timestamp,
          };
        } else {
          this.currentCandle.high = Math.max(this.currentCandle.high, price);
          this.currentCandle.low = Math.min(this.currentCandle.low, price);
          this.currentCandle.close = price;
        }
        this.currentCandle.volume += parseFloat(match.size);
      });
  };

  updateSMA = (price?: number) => {
    if (price) {
      this.sma.update(price);
    }
  };

  setSMA = (period: number) => {
    this.sma = new SMA(period);
  };

  getSMA = () => {
    try {
      const res = this.sma.getResult();
      return res;
    } catch (error: any) {
      if (error.constructor.name !== 'NotEnoughDataError') {
        console.log(error);
      }
      return null;
    }
  };

  updateBollingerBands = (price?: number) => {
    if (price) {
      this.bollingerBands.update(price);
    }
  };

  onSocketMessage = (event: MessageEvent) => {
    const res = JSON.parse(event.data),
      { type } = res;

    this.lastMessage$.next(res);
    this.allTypes[type] = true;

    if (type === 'snapshot') {
      this.snapshots.push(res);
    }
  };

  start = () => {
    // I can probably get a drop-in websocket rxjs library
    this.isSocketOpen$.subscribe((isOpen) => {
      if (isOpen) {
        console.log('Socket is open, INIT subscribe');
        socket.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: ['ETH-USD'],
            // channels: ['full'],
            channels: ['matches'],
          })
        );
      } else {
        console.log('Socket is closed, INIT unsubscribe');
      }
    });

    this.getProductCandles({ id: 'ETH-USD', granularity: 60 }).then(
      (res: any) => {
        const candles: Candle[] = res.map((data: any) => ({
          high: parseFloat(data[2]),
          low: parseFloat(data[1]),
          open: parseFloat(data[3]),
          close: parseFloat(data[4]),
          volume: parseFloat(data[5]),
          timestamp: new Date(data[0] * 1000).getTime(),
        }));
        this.pastCandles = candles.reverse();
      }
    );
  };

  // Likely in another service:
  getProductCandles = async (args: GetProductCandlesArgs) => {
    let url = `${EXCHANGE_URL}/products/${args.id}/candles`;
    console.log(args);
    if (args.granularity) {
      url += `?granularity=${args.granularity}`;
    }

    if (args.startAndEnd) {
      url += `?start=${args.startAndEnd.start.toISOString()}&end=${args.startAndEnd.end.toISOString()}`;
    }

    console.log(url);

    const options = {
      method: 'GET',
      url,
      headers: { accept: 'application/json' },
    };

    // return options;

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
type GetProductCandlesArgs = {
  id: string;
  granularity?: CandleGranularity;
  startAndEnd?: StartAndEnd;
};
