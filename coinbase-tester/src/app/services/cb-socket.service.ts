import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, first, map, Observable, Subject } from 'rxjs';
import { MergedTrade } from './cb-feed.service';
const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';

@Injectable({
  providedIn: 'root',
})
export class CbSocketService {
  constructor() {}

  // Per coinbase docs, they recommend multiple sockets for multiple feeds
  createSocket = <T>(): ActiveSocket<T> => {
    const socket = new WebSocket(FEED_URL);
    const isOpen$ = new BehaviorSubject(false);
    const lastError$ = new Subject<any>();
    const lastMessage$ = new Subject<any>();
    const eventTypes: Record<string, boolean> = {};
    const activeSubscriptions: SubscriptionMessage[] = [];
    // probably need a way to clean this up too. Do we need to proactively unsubscribe sockets?
    const addMatchSubscription = (productIds: string[]) =>
      isOpen$
        .pipe(
          filter((isOpen) => isOpen),
          first()
        )
        .subscribe(() => {
          const msg = this.subscribeToMatches(socket, productIds);
          activeSubscriptions.push(msg);
        });

    socket.onopen = () => isOpen$.next(true);
    socket.onclose = () => isOpen$.next(false);
    socket.onerror = (error) => lastError$.next(error);
    socket.onmessage = (event) => {
      const res = JSON.parse(event.data);
      const { type } = res;

      lastMessage$.next(res);
      eventTypes[type] = true;
    };

    const socketHolder: ActiveSocket<T> = {
      socket,
      eventTypes,
      isOpen$,
      lastError$,
      lastMessage$,
      addMatchSubscription,
      activeSubscriptions,
    };

    return socketHolder;
  };

  subscribeToMatches = (socket: WebSocket, product_ids: string[]) => {
    const msg: SubscriptionMessage = {
      type: 'subscribe',
      product_ids,
      channels: ['matches'],
    };
    socket.send(JSON.stringify(msg));
    return msg;
  };
}

export type ActiveSocket<T = {}> = {
  socket: WebSocket;
  eventTypes: Record<string, boolean>;
  isOpen$: BehaviorSubject<boolean>;
  lastError$: Subject<any>;
  lastMessage$: Subject<T>;
  addMatchSubscription: (productIds: string[]) => void;
  activeSubscriptions: SubscriptionMessage[];
};

type SubscriptionMessage = {
  type: 'subscribe';
  product_ids: string[];
  channels: string[]; //maybe string literal e.g. 'matches' | 'ticker' | 'level2' | 'heartbeat'
};

// Should be subset/union with a type for all messages
export type MatchMessage = {
  maker_order_id: string; // "a5061d9b-b977-41a1-9d05-a862437a78ae"
  //either pre-process or make a post-process type where this is number/Big
  price: string; // "1319.3"
  // Should be string literal type e.g. "ETH-USD" | "BTC-USD"
  product_id: string; // "ETH-USD"
  sequence: number; // 36833737703
  // String literal e.g. "buy" | "sell"
  side: 'buy' | 'sell'; // "sell"
  // Post-processed type could be number/Big
  size: string; // "0.16793782"
  taker_order_id: string; // "0e0a4b73-aa4f-4274-97e4-7d49bf3f1c3c"
  // Post-processed type likely Date or number
  time: string; // "2022-10-01T16:18:18.157446Z"
  trade_id: number; // 363415764
  // String literal e.g. "match" | "done" | "open" | "received"
  type: string; // "match"
};
