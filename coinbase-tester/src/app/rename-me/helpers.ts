import { Candle } from '../models';

export const logCandle = (candle: Candle) => {
  const loggable = {
    high: candle?.high.toString(),
    low: candle?.low.toString(),
    open: candle?.open.toString(),
    close: candle?.close.toString(),
    volume: candle?.volume.toString(),
    date: candle?.date,
    timestamp: candle?.timestamp,
    minute: candle?.minute,
  };
  console.log(loggable);
};
