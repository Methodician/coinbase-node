// simplified version of in-memory database
// support operations to manipulate records, fields, and values within fields
const queries = [
  ['SET', 'employee1', 'city', 'Annapolis'],
  ['SET', 'employee2', 'id', '0123'],
  ['GET', 'employee1', 'city'],
];
const expectedOutput = ['', '', 'Annapolis'];

const queries2 = [
  ['SET', 'book1', 'title', 'Island'],
  ['GET', 'book1', 'title'],
  ['DELETE', 'book1', 'title'],
  ['GET', 'book1', 'title'],
];

const output2 = ['', 'Island', 'true', ''];

const queries3 = [
  ['SET', 'a', 'b', 'c'],
  ['SET', 'a', 'c', 'd'],
  ['GET', 'c', 'a'],
  ['SCAN', 'a', 'c'],
  ['SCAN', 'a', 'c'],
  ['SET', 'a', 'd', 'e'],
  ['DELETE', 'a', 'c'],
  ['DELETE', 'a', 'c'],
  ['SET', 'a', 'e', 'f'],
  ['DELETE', 'a', 'b'],
  ['SET', 'a', 'f', 'g'],
  ['GET', 'a', 'c'],
  ['SCAN', 'a', ''],
];

const output3 = [
  '',
  '',
  '',
  'c(d)',
  'c(d)',
  '',
  'true',
  'false',
  '',
  'true',
  '',
  '',
  'd(e), e(f), f(g)',
];

const queries4 = [
  ['SET', 'dept4', 'first', '1'],
  ['SET', 'dept4', 'second', '2'],
  ['SET', 'dept4', 'fifth', '5'],
  ['SCAN', 'dept4', 'fi'],
  ['GET', 'dept4', 'first'],
  ['SCAN', 'dept4', 'sec'],
];

const output4 = ['', '', '', 'fifth(5), first(1)', '1', 'second(2)'];

const queries5 = [
  ['SET_AT', 'a', 'b', 'c', '160000010', '90'],
  ['SET_AT', 'aaa', 'bbb', 'ccc', '160000015', '175'],
  ['SET_AT', 'a', 'bb', 'cc', '160000020', '60'],
  ['SET_AT', 'aaa', 'bb', 'd', '160000022', '198'],
  ['SET_AT', 'a', 'bc', 'ca', '160000024', '46'],
  ['SET_AT', 'a', 'bbc', 'cc', '160000025', '146'],
  ['SCAN_AT', 'a', 'b', '160000030'],
  ['SET_AT', 'a', 'bcc', 'caa', '160000038', '12'],
  ['SCAN_AT', 'a', 'b', '160000050'],
  ['DELETE_AT', 'a', 'bc', '160000055'],
  ['DELETE_AT', 'a', 'bb', '160000080'],
  ['SCAN_AT', 'a', 'b', '160000095'],
  ['SCAN_AT', 'a', '', '160000160'],
];

const output5 = [
  '',
  '',
  '',
  '',
  '',
  '',
  'b(c), bb(cc), bbc(cc), bc(ca)',
  '',
  'b(c), bb(cc), bbc(cc), bc(ca)',
  'true',
  'false',
  'b(c), bbc(cc)',
  'bbc(cc)',
];

const queries6 = [
  ['SET_AT', 'foo', 'bar', 'baz', '160000000', '50'],
  ['GET_AT', 'foo', 'bar', '160000020'],
  ['GET_AT', 'foo', 'bar', '160000030'],
  ['GET_AT', 'foo', 'bar', '160000050'],
  ['GET_AT', 'foo', 'bar', '160000080'],
];

const output6 = ['', 'baz', 'baz', '', ''];

const queries7 = [
  ['SCAN_AT', 'key1', 'key', '160000010'],
  ['GET_AT', 'key1', 'key2', '160000012'],
  ['SET_AT', 'key1', 'key2', 'str', '160000020', '20'],
  ['SET_AT', 'key1', 'key3', 'c', '160000021', '39'],
  ['GET_AT', 'key1', 'key2', '160000022'],
  ['SCAN_AT', 'key1', 'key', '160000030'],
  ['SCAN_AT', 'key1', 'key', '160000032'],
  ['SCAN_AT', 'key1', 'key', '160000050'],
  ['SCAN_AT', 'key1', 'key', '160000060'],
];

const output7 = [
  '',
  '',
  '',
  '',
  'str',
  'key2(str), key3(c)',
  'key2(str), key3(c)',
  'key3(c)',
  '',
];

const solution = (queries: string[][]): string[] => {
  const db: Record<
    string,
    Record<string, { val: string; timestamp?: number; ttl?: number }>
  > = {};
  const output: string[] = [];

  const set = (key: string, field: string, value: string) => {
    if (!db[key]) {
      db[key] = {};
    }
    db[key][field] = { val: value };
    output.push('');
  };

  // set supporting ttl
  const setAt = (
    key: string,
    field: string,
    value: string,
    timestamp: string,
    ttl: string
  ) => {
    if (!db[key]) {
      db[key] = {};
    }
    db[key][field] = { val: value, timestamp: +timestamp, ttl: +ttl };
    output.push('');
  };

  const remove = (key: string, field: string) => {
    if (db[key] && db[key][field]) {
      delete db[key][field];
      output.push('true');
    } else {
      output.push('false');
    }
  };

  const removeAt = (key: string, field: string, timestamp: string) => {
    if (
      db[key] &&
      db[key][field] &&
      db[key][field].timestamp &&
      db[key][field].ttl
    ) {
      if (db[key][field].timestamp! + db[key][field].ttl! > +timestamp) {
        delete db[key][field];
        output.push('true');
      } else {
        output.push('false');
      }
    } else {
      output.push('false');
    }
  };

  const get = (key: string, field: string) => {
    if (db[key] && db[key][field]) {
      output.push(db[key][field].val);
    } else {
      output.push('');
    }
  };

  const getAt = (key: string, field: string, timestamp: string) => {
    const ts = Number(timestamp);
    if (
      db[key] &&
      db[key][field] &&
      db[key][field].timestamp &&
      db[key][field].ttl
    ) {
      console.log(timestamp);
      if (db[key][field].timestamp! + db[key][field].ttl! > ts) {
        output.push(db[key][field].val);
      } else {
        output.push('');
      }
    } else {
      output.push('');
    }
  };

  const scan = (key: string, field: string) => {
    if (db[key]) {
      // sort results lexicographically
      const fields = Object.keys(db[key]);
      const filteredFields = fields.filter((f) => f.startsWith(field));
      const result = filteredFields
        .map((f) => `${f}(${db[key][f].val})`)
        .sort((a, b) => a.localeCompare(b))
        .join(', ');
      output.push(result);
    } else {
      output.push('');
    }
  };

  const scanAt = (key: string, field: string, timestamp: string) => {
    console.log(db);
    console.log({ key, field, timestamp });
    if (db[key]) {
      console.log('SCANNING');
      const ts = Number(timestamp);
      // sort results lexicographically
      const fields = Object.keys(db[key]);
      console.log(fields);
      const filteredFields = fields.filter((f) => {
        return (
          f.startsWith(field) && db[key][f].timestamp! + db[key][f].ttl! > ts
        );
      });
      const result = filteredFields
        .map((f) => `${f}(${db[key][f].val})`)
        .sort((a, b) => a.localeCompare(b))
        .join(', ');
      output.push(result);
    } else {
      output.push('');
    }
  };

  // remove any expired records

  for (const query of queries) {
    const [operation, key, field, value, timestamp, ttl] = query;
    if (operation === 'SET') {
      set(key, field, value);
    } else if (operation === 'GET') {
      get(key, field);
    } else if (operation === 'DELETE') {
      remove(key, field);
    } else if (operation === 'SCAN') {
      scan(key, field);
    } else if (operation === 'SET_AT') {
      setAt(key, field, value, timestamp, ttl);
    } else if (operation === 'GET_AT') {
      getAt(key, field, value);
    } else if (operation === 'DELETE_AT') {
      removeAt(key, field, value);
    } else if (operation === 'SCAN_AT') {
      scanAt(key, field, value);
    }
    // console.log(db);
  }
  return output;
};

console.log(solution(queries7));
