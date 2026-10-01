import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/cache.js';
test('TTL expires exactly at the boundary', async () => {
  let now = 0, calls = 0;
  const cache = createCache({ clock: () => now });
  const load = async () => ++calls;
  assert.equal((await cache.get(load)).status, 'MISS');
  now = 999;
  assert.equal((await cache.get(load)).body, 1);
  now = 1000;
  assert.equal((await cache.get(load)).body, 2);
});
test('concurrent misses use one loader and failures allow retry', async () => {
  const cache = createCache();
  let calls = 0;
  const results = await Promise.all(Array.from({ length: 100 }, () => cache.get(async () => { calls++; await new Promise(r => setTimeout(r, 5)); return 'body'; })));
  assert.equal(calls, 1);
  assert.equal(results.filter(r => r.status === 'COALESCED').length, 99);
  cache.invalidate();
  await assert.rejects(cache.get(async () => { throw Error('Database down'); }));
  assert.equal((await cache.get(async () => 'recovered')).body, 'recovered');
});
test('invalidating during a read prevents the old read repopulating the cache', async () => {
  const cache = createCache();
  let resolve;
  const old = cache.get(() => new Promise(r => { resolve = r; }));
  await Promise.resolve();
  cache.invalidate();
  await cache.get(async () => 'new');
  resolve('old');
  await old;
  assert.equal((await cache.get(async () => 'unexpected')).body, 'new');
});
