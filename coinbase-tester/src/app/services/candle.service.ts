import { Injectable } from '@angular/core';
import { CbFeedService, MergedTrade } from './cb-feed.service';

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

@Injectable({
  providedIn: 'root',
})
export class CandleService {
  // I suspect a reliable strategy would be to always place buy and sell orders but distance and scale them based on the signals
  // My buys move closer and/or higher or further and/or lower and sells do the opposite based on signals
  // Although, there may be viable exceptions where the scale should move away from the price...

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
  constructor(private feedSvc: CbFeedService) {}

  buildCandles = async (productId: string) => {
    let wasContinuityChecked = false;
    let isTradeHistoryProcessed = false;
    const { transferFeed } = await this.feedSvc.getLinearTrades(productId, 200);
    const { historicalTrades, tradeStream$ } = transferFeed();
    // attempt to reconcile history with stream
    tradeStream$.subscribe((trade) => {
      if (!wasContinuityChecked) {
        // ensure the final trade from history is just before the first trade in stream
        // Maybe not the best place for this check, but for now...
        wasContinuityChecked = true;
        const lastHistoricalId =
          historicalTrades[historicalTrades.length - 1].tradeId;
        const firstStreamId = trade.tradeId;
        if (lastHistoricalId !== firstStreamId - 1) {
          alert('Trade ID continuity was broken');
        }
        wasContinuityChecked = true;
      }
      if (!isTradeHistoryProcessed) {
        // process historical trades before stream
        console.log('creating historical candles');
        this.createHistoricalCandles(historicalTrades);
        isTradeHistoryProcessed = true;
      }
      this.addTrade(trade);
    });
  };

  createHistoricalCandles = (trades: MergedTrade[]) => {
    for (let trade of trades) {
      this.addTrade(trade);
    }
  };

  addTrade = (trade: MergedTrade) => {
    const { price, size, date } = trade;
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
        timestamp,
        timeSinceLastCandle: timestamp - this.lastCandle.timestamp,
      };
    };
    const iterateCandleTrackers = () => {
      this.lastCandle = this.currentCandle;
      this.pastCandles.push(this.currentCandle);
    };

    if (this.currentMinute === undefined) {
      this.lastCandle.timestamp = timestamp;
      updateCurrentMinute();
      restartCurrentCandle();
    } else if (this.currentMinute !== minute) {
      iterateCandleTrackers();
      restartCurrentCandle();
      updateCurrentMinute();
    } else {
      updateCurrentCandle();
    }
  };
}

// Maybe a new CandleService could manage these things
// Some of these number types could be Big numbers
export type Candle = {
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
