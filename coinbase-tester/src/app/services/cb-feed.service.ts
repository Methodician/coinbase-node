import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, map, Subject } from 'rxjs';
import { BollingerBands, NotEnoughDataError, SMA } from 'trading-signals';
import axios from 'axios';
const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';
const EXCHANGE_URL = 'https://api.exchange.coinbase.com';
const socket = new WebSocket(FEED_URL);

const STARTER_CANDLE = {
  high: 0,
  low: 0,
  open: 0,
  close: 0,
  volume: 0,
  timestamp: 0,
  date: new Date(),
  timeSinceLastCandle: 0,
  minute: 0,
};

// Should be subset/union with a type for all messages
type MatchMessage = {
  maker_order_id: string; // "a5061d9b-b977-41a1-9d05-a862437a78ae"
  //either pre-process or make a post-process type where this is number/Big
  price: string; // "1319.3"
  // Should be string literal type e.g. "ETH-USD" | "BTC-USD"
  product_id: string; // "ETH-USD"
  sequence: number; // 36833737703
  // String literal e.g. "buy" | "sell"
  side: string; // "sell"
  // Post-processed type could be number/Big
  size: string; // "0.16793782"
  taker_order_id: string; // "0e0a4b73-aa4f-4274-97e4-7d49bf3f1c3c"
  // Post-processed type likely Date or number
  time: string; // "2022-10-01T16:18:18.157446Z"
  trade_id: number; // 363415764
  // String literal e.g. "match" | "done" | "open" | "received"
  type: string; // "match"
};

// Some of these number types could be Big numbers
type Candle = {
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
  timestamp: number;
  date: Date;
  minute: number;
  timeSinceLastCandle: number; // For testing only (I think, since it is theoretically inferrable)
};

@Injectable({
  providedIn: 'root',
})
export class CbFeedService {
  // I suspect a reliable strategy would be to always place buy and sell orders but distance and scale them based on the signals
  // My buys move closer and/or higher or further and/or lower and sells do the opposite based on signals
  // Although, there may be viable exceptions where the scale should move away from the price...
  private isSocketOpen$ = new BehaviorSubject(false);
  private lastSocketError$ = new Subject<any>();
  lastMessage$ = new Subject<any>();
  lastMatch$ = this.lastMessage$.pipe(
    filter((msg) => msg.type === 'match')
  ) as Subject<MatchMessage>;
  processedMatches$ = this.lastMatch$.pipe(
    map(({ price, product_id, size, time }) => ({
      price: Number(price),
      productId: product_id,
      size: Number(size),
      date: new Date(time),
    }))
  );

  allTypes: Record<string, boolean> = {};

  // bollingerBands: BollingerBands = new BollingerBands(30, 2);

  currentMinute?: number;
  // May actually need to rebuild last/current candle from another REST call to get matches if I want to reconcile the immediate one
  // Also maybe best to just get matches and build all candles locally
  currentCandle: Candle = STARTER_CANDLE;
  lastCandle: Candle = STARTER_CANDLE;

  // NOTE: I think I need to delay the call to REST so I can ensure my current candle is always aligned with the last one from REST
  // Possibly even do a check and restart the process if the last candle from REST is not the timing is off
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

    this.start();
    this.watchMatches();
  }

  watchMatches = () => {
    // pipe takeUntil unsubscribe
    // Should also account for multiple productIds
    this.processedMatches$.subscribe(({ price, size, date }) => {
      const timestamp = date.getTime();
      const minute = date.getMinutes();
      const restartCurrentCandle = () => {
        this.currentCandle = {
          timeSinceLastCandle: timestamp - this.lastCandle.timestamp,
          timestamp,
          date,
          minute,
          high: price,
          low: price,
          open: price,
          close: price,
          volume: size,
        };
      };
      const updateCurrentMinute = () => {
        this.currentMinute = minute;
      };
      const updateCurrentCandle = () => {
        this.currentCandle = {
          ...this.currentCandle,
          high: Math.max(this.currentCandle.high, price),
          low: Math.min(this.currentCandle.low, price),
          close: price,
          volume: this.currentCandle.volume + size,
          timeSinceLastCandle: timestamp - this.lastCandle.timestamp,
        };
      };
      const iterateCandleTrackers = () => {
        this.lastCandle = this.currentCandle;
        this.pastCandles.push(this.currentCandle);
      };
      if (this.currentMinute === undefined) {
        updateCurrentMinute();
        restartCurrentCandle();
      } else if (this.currentMinute !== minute) {
        iterateCandleTrackers();
        restartCurrentCandle();
        updateCurrentMinute();
      } else {
        updateCurrentCandle();
      }
    });
  };

  // updateSMA = (price?: number) => {
  //   if (price) {
  //     this.sma.update(price);
  //   }
  // };

  // setSMA = (period: number) => {
  //   this.sma = new SMA(period);
  // };

  // getSMA = () => {
  //   try {
  //     const res = this.sma.getResult();
  //     return res;
  //   } catch (error: any) {
  //     if (error.constructor.name !== 'NotEnoughDataError') {
  //       console.log(error);
  //     }
  //     return null;
  //   }
  // };

  // updateBollingerBands = (price?: number) => {
  //   if (price) {
  //     this.bollingerBands.update(price);
  //   }
  // };

  onSocketMessage = (event: MessageEvent) => {
    const res = JSON.parse(event.data),
      { type } = res;

    this.lastMessage$.next(res);
    this.allTypes[type] = true;
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

    const end = new Date();
    // 5 minutes ago
    const start = new Date(end.getTime() - 5 * 60000);
    // const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 30);
    this.getProductCandles({
      id: 'ETH-USD',
      granularity: 60,
      startAndEnd: { start, end },
    }).then((res: any) => {
      if (!res) {
        return;
      }
      let lastCandleTimestamp =
        new Date(res[res.length - 1][0] * 1000).getTime() - 60000;
      const candles: Candle[] = res.reverse().map((data: any) => {
        const [time, low, high, open, close, volume] = data;
        const date = new Date(time * 1000);
        const timestamp = date.getTime();
        const timeSinceLastCandle = timestamp - lastCandleTimestamp;
        const candle: Candle = {
          high,
          low,
          open,
          close,
          volume,
          timestamp,
          timeSinceLastCandle,
          date,
          minute: date.getMinutes(),
        };
        lastCandleTimestamp = timestamp;
        return candle;
      });
      this.pastCandles = candles;
      this.lastCandle = candles[candles.length - 1];
    });
  };

  // Likely in another service:
  getProductCandles = async (args: GetProductCandlesArgs) => {
    let url = `${EXCHANGE_URL}/products/${args.id}/candles`;
    console.log(args);
    // /products/ETH-USD/candles?granularity=60&start=213&end=123'
    let paramSeparator = '?';
    if (args.granularity) {
      url += `${paramSeparator}granularity=${args.granularity}`;
      paramSeparator = '&';
    }

    if (args.startAndEnd) {
      url += `${paramSeparator}start=${args.startAndEnd.start.toISOString()}&end=${args.startAndEnd.end.toISOString()}`;
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
