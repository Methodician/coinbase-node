import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, filter, Subject, timer } from 'rxjs';
const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';
const socket = new WebSocket(FEED_URL);

@Injectable({
  providedIn: 'root',
})
export class CbFeedService {
  private isSocketOpen$ = new BehaviorSubject(false);
  private lastSocketError$ = new Subject<any>();
  lastMessage$ = new Subject<any>();
  allTypes: Record<string, boolean> = {};

  snapshots: any[] = [];

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
  }

  onSocketMessage = (event: MessageEvent) => {
    console.log('Updating last message');
    const res = JSON.parse(event.data),
      { type } = res;

    this.lastMessage$.next(res);
    this.allTypes[type] = true;

    if (type === 'snapshot') {
      this.snapshots.push(res);
    }
  };

  testStart = () => {
    // I can probably get a drop-in websocket rxjs library
    this.isSocketOpen$.subscribe((isOpen) => {
      if (isOpen) {
        console.log('Socket is open, INIT subscribe');
        socket.send(
          JSON.stringify({
            type: 'subscribe',
            channels: [{ name: 'full', product_ids: ['ETH-USD'] }],
          })
        );
      }
    });

    // timer(5000).subscribe(() => {
    //   this.isSocketOpen$.subscribe((isOpen) => {
    //     if (isOpen) {
    //       console.log('Socket is open, DELAYED subscribe');
    //       socket.send(
    //         JSON.stringify({
    //           type: 'subscribe',
    //           channels: [
    //             {
    //               name: 'level2',
    //               product_ids: ['ETH-USD', 'ETH-EUR'],
    //             },
    //             {
    //               name: 'heartbeat',
    //               product_ids: ['ETH-USD', 'ETH-EUR'],
    //             },
    //             {
    //               name: 'ticker',
    //               product_ids: ['ETH-USD', 'ETH-EUR', 'ETH-BTC'],
    //             },
    //           ],
    //         })
    //       );
    //     }
    //   });
    // });

    // socket.onopen = () => {
    //   console.log('Connected to Coinbase Pro WebSocket Feed');
    //   socket.send(
    //     JSON.stringify({
    //       type: 'subscribe',
    //       channels: [{ name: 'ticker', product_ids: ['ETH-USD'] }],
    //     })
    //   );
    // };

    // socket.onmessage = (event) => {
    //   console.log('Received message from Coinbase Pro WebSocket Feed');
    //   result$.next(JSON.parse(event.data));
    // };
  };
}
