const http = require('http');
require('dotenv').config();

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req: any, res: any) => {
  res.statusCode = 200;
  // res.setHeader("Content-Type", "text/plain");
  res.setHeader('Content-Type', 'application/json');
  // res.end("Hello World");
  // web3Js().then((data) => {
  //   res.end(data);
  // });

  // testCommerceAuth().then((data) => {
  //   res.end(JSON.stringify(data, null, 2));
  // // });
  // testExchangeAuth().then((data) => {
  //   res.end(JSON.stringify(data, null, 2));
  // });

  // getAllCurrencies().then((data) => {
  //   console.log(data);
  //   res.end(JSON.stringify(data, null, 2));
  // });

  // res.end(JSON.stringify(process.env, null, 2));

  // const yesterday = new Date();
  // yesterday.setDate(yesterday.getDate() - 1);

  // getProductCandles({
  //   id: "ETH-USD",
  //   granularity: 21600,
  //   // startAndEnd: {
  //   //   start: yesterday,
  //   //   end: new Date(),
  //   // },
  // }).then((data) => {
  //   res.end(JSON.stringify(data, null, 2));
  // });

  // getAllTradingPairs().then((data) => {
  //   console.log(data);
  //   res.end(JSON.stringify(data, null, 2));
  // });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

const logError = (error: any) => {
  if (!error.code && !error.response.data) {
    console.error('Request Error: ', error);
  }
  console.error('Request Error: ', error.code, error.response.data);
};

const testCommerceAuth = async () => {
  const { key, version } = commerceEnvForSure();

  const options = {
    method: 'GET',
    url: 'https://api.commerce.coinbase.com/charges',
    headers: {
      accept: 'application/json',
      'X-CC-Api-Key': key,
      'X-CC-Version': version,
    },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error(JSON.stringify(error, null, 2));
  }
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
const getProductCandles = async (args: GetProductCandlesArgs) => {
  let url = `https://api.exchange.coinbase.com/products/${args.id}/candles`;
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

const getProductBook = async (id: string) => {
  console.log('getting product book');
  const options = {
    method: 'GET',
    url: `https://api.exchange.coinbase.com/products/${id}/book?level=2`,
    headers: { accept: 'application/json' },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }
};

const getSingleProduct = async (id: string) => {
  const options = {
    method: 'GET',
    url: `https://api.exchange.coinbase.com/products/${id}`,
    headers: { accept: 'application/json' },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }
};

const getAllTradingPairs = async () => {
  const options = {
    method: 'GET',
    url: 'https://api.exchange.coinbase.com/products',
    headers: { accept: 'application/json' },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }

  axios
    .request(options)
    .then(function (response) {
      console.log(response.data);
    })
    .catch(function (error) {
      console.error(error);
    });
};

const getCurrencyById = async (id: string) => {
  const options = {
    method: 'GET',
    url: `https://api.exchange.coinbase.com/currencies/${id}`,
    headers: { accept: 'application/json' },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }
};

const getAllCurrencies = async () => {
  const options = {
    method: 'GET',
    url: 'https://api.exchange.coinbase.com/currencies',
    headers: { accept: 'application/json' },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }
};

const testExchangeAuth = async () => {
  const {
    data: { epoch },
  } = await getCoinbaseTime();

  const { key, secret, passphrase } = exchangeEnvForSure();

  const signature = await createExchangeSignature(secret, '/accounts', epoch);

  const options = {
    method: 'GET',
    url: 'https://api.exchange.coinbase.com/accounts',
    headers: {
      accept: 'application/json',
      'CB-ACCESS-KEY': key,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-PASSPHRASE': passphrase,
      'CB-ACCESS-TIMESTAMP': epoch,
    },
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }
};

// === HELPERS ===
const exchangeEnvForSure = () => {
  const {
    EXCHANGE_KEY: key,
    EXCHANGE_SECRET: secret,
    EXCHANGE_PASSPHRASE: passphrase,
  } = process.env;
  if (!key || !secret || !passphrase) {
    throw new Error('Missing exchange environment variables');
  }

  return {
    key,
    secret,
    passphrase,
  };
};

const commerceEnvForSure = () => {
  const { COMMERCE_KEY: key, COMMERCE_VERSION: version } = process.env;
  if (!key || !version) {
    throw new Error('Missing commerce environment variables');
  }

  return {
    key,
    version,
  };
};

const getCoinbaseTime = async () => {
  console.log('getCoinbaseTime');

  const options = {
    method: 'GET',
    url: 'https://api.coinbase.com/v2/time',
  };

  try {
    const res = await axios.request(options);
    return res.data;
  } catch (error) {
    console.error('Request Error: ', error);
  }
};

const createExchangeSignature = async (
  secret: string,
  path: string,
  timestamp: number
) => {
  const sigString = timestamp + 'GET' + path;
  const key = Buffer.from(secret, 'base64');
  const hmac = crypto.createHmac('sha256', key);
  const signature = hmac.update(sigString).digest('base64');

  return signature;
};
