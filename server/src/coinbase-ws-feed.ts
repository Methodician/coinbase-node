import { WebSocket } from 'ws';
require('dotenv').config();

const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';

const socket = new WebSocket(FEED_URL);

socket.onopen = () => {
  console.log('Connected to Coinbase Pro WebSocket Feed');
  socket.send(
    JSON.stringify({
      type: 'subscribe',
      product_ids: ['ETH-USD'],
      channels: [
        'level2',
        'heartbeat',
        { name: 'ticker', product_ids: ['ETH-USD', 'ETH-BTC'] },
      ],
    })
  );
};

socket.onmessage = (event) => {
  console.log('Received message from Coinbase Pro WebSocket Feed');
  console.log(event.data);
};
