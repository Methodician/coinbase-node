import { WebSocket, MessageEvent } from 'ws';
require('dotenv').config();
// import { Subject } from 'rxjs';
// import axios from 'axios';
const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';

// const onMessage$ = new Subject<MessageEvent>();

const testIt = () => {
  //   socket.onopen = () => {
  //     console.log('Marking socket as open');
  //     socket.send(
  //       JSON.stringify({
  //         type: 'subscribe',
  //         channels: [{ name: 'full', product_ids: ['ETH-USD'] }],
  //       })
  //     );
  //   };
  //   const messages$ = webSocket<MessageEvent>(FEED_URL);
  //   socket.onmessage = (event: MessageEvent) => {
  //     console.log('Updating last message');
  //     if (typeof event.data === 'string') {
  //       const res = JSON.parse(event.data);
  //       //   { type } = res;
  //       // console.log('Type: ', type);
  //       console.log(res);
  //     }
  //   };
};

testIt();

// libs to try ASAP:
// https://www.npmjs.com/package/trading-signals (current)
// https://www.npmjs.com/package/technicalindicators (top alt but older, may not try)
// possible libs to try later:
// https://www.npmjs.com/package/rxjs-websockets
// https://www.npmjs.com/package/candlestick
// https://www.npmjs.com/package/indicatorts
// https://github.com/cinar/indicatorts
