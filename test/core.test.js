import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBaggage, extractTraceContext, extractAll } from '../src/index.js';

test('extractBaggage parses a single key-value pair', () => {
  const headers = { baggage: 'userId=42' };
  assert.deepEqual(extractBaggage(headers), { userid: '42' });
});

test('extractBaggage parses multiple comma-separated pairs', () => {
  const headers = { baggage: 'userId=42,sessionId=abc,role=admin' };
  assert.deepEqual(extractBaggage(headers), {
    userid: '42',
    sessionid: 'abc',
    role: 'admin',
  });
});

test('extractBaggage normalizes keys to lowercase', () => {
  const headers = { baggage: 'UserId=1,SESSIONID=2' };
  assert.deepEqual(extractBaggage(headers), { userid: '1', sessionid: '2' });
});

test('extractBaggage trims whitespace around keys and values', () => {
  const headers = { baggage: '  userId  =  42  ,  env=prod ' };
  assert.deepEqual(extractBaggage(headers), { userid: '42', env: 'prod' });
});

test('extractBaggage ignores properties after semicolon', () => {
  const headers = { baggage: 'userId=42;properties=stuff,env=prod' };
  assert.deepEqual(extractBaggage(headers), { userid: '42', env: 'prod' });
});

test('extractBaggage skips pairs without equals sign', () => {
  const headers = { baggage: 'valid=1,invalid,alsogood=2' };
  assert.deepEqual(extractBaggage(headers), { valid: '1', alsogood: '2' });
});

test('extractBaggage returns empty object when header missing', () => {
  assert.deepEqual(extractBaggage({}), {});
  assert.deepEqual(extractBaggage(null), {});
});

test('extractBaggage finds header case-insensitively', () => {
  const headers = { BAGGAGE: 'a=1' };
  assert.deepEqual(extractBaggage(headers), { a: '1' });
});

test('extractBaggage last-writer-wins on duplicate keys', () => {
  const headers = { baggage: 'k=1,k=2' };
  assert.deepEqual(extractBaggage(headers), { k: '2' });
});

test('extractTraceContext parses valid traceparent', () => {
  const headers = {
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  };
  const result = extractTraceContext(headers);
  assert.equal(result.traceparent, '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
  assert.equal(result.tracestate, null);
});

test('extractTraceContext rejects malformed traceparent', () => {
  const headers = { traceparent: 'not-a-valid-traceparent' };
  const result = extractTraceContext(headers);
  assert.equal(result.traceparent, null);
});

test('extractTraceContext lowercases traceparent', () => {
  const headers = {
    traceparent: '00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01',
  };
  const result = extractTraceContext(headers);
  assert.equal(result.traceparent, '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
});

test('extractTraceContext passes through tracestate trimmed', () => {
  const headers = {
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    tracestate: '  vendor=value  ',
  };
  const result = extractTraceContext(headers);
  assert.equal(result.tracestate, 'vendor=value');
});

test('extractAll combines baggage and trace context', () => {
  const headers = {
    baggage: 'userId=42',
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    tracestate: 'v=1',
  };
  const result = extractAll(headers);
  assert.deepEqual(result, {
    baggage: { userid: '42' },
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    tracestate: 'v=1',
  });
});

test('extractTraceContext returns nulls when headers missing', () => {
  const result = extractTraceContext({});
  assert.equal(result.traceparent, null);
  assert.equal(result.tracestate, null);
});

test('extractTraceContext handles null input safely', () => {
  const result = extractTraceContext(null);
  assert.equal(result.traceparent, null);
  assert.equal(result.tracestate, null);
});
