import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
test('PostgreSQL feed, create, concurrent idempotent likes and missing posts', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const store = createStore('postgres');
  t.after(() => store.close());
  assert.equal((await store.feed()).length, 20);
  const created = await store.create(1, 'PostgreSQL integration');
  await Promise.all(Array.from({ length: 20 }, () => store.like(created.id, 2)));
  assert.equal((await store.post(created.id)).likes, 1);
  assert.equal((await store.feed())[0].id, created.id);
  assert.equal(await store.like(2147483647, 1), undefined);
  await assert.rejects(store.create(2147483647, 'Unknown user'), { code: '23503' });
});
