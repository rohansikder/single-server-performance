import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
async function setup(t, mode = 'baseline', store = createStore('memory')) {
  const server = createApp({ store, mode, source: 'memory' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); await store.close(); });
  return (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('baseline queries on every request; cached mode queries once', async t => {
  for (const mode of ['baseline', 'node-cache']) {
    const request = await setup(t, mode);
    for (let i = 0; i < 5; i++) assert.equal((await request('/feed')).status, 200);
    const metrics = await (await request('/metrics')).json();
    assert.equal(metrics.feedQueries, mode === 'baseline' ? 5 : 1);
    assert.equal(metrics.cacheHits, mode === 'baseline' ? 0 : 4);
  }
});
test('writes invalidate Node cache and duplicate likes are idempotent', async t => {
  const request = await setup(t, 'node-cache');
  await request('/feed');
  const created = await request('/posts', post({ userId: 1, body: 'Feed cache experiment' }));
  assert.equal(created.status, 201);
  const record = await created.json();
  const feed = await request('/feed');
  assert.equal(feed.headers.get('x-app-cache'), 'MISS');
  assert.equal((await feed.json()).posts[0].body, 'Feed cache experiment');
  await request(`/posts/${record.id}/like`, post({ userId: 2 }));
  await request(`/posts/${record.id}/like`, post({ userId: 2 }));
  assert.equal((await (await request(`/posts/${record.id}`)).json()).likes, 1);
});
test('invalid input and missing routes return explicit errors', async t => {
  const request = await setup(t);
  assert.equal((await request('/posts', post({ userId: -1, body: 'hello' }))).status, 400);
  assert.equal((await request('/posts', post({ userId: 1, body: '' }))).status, 400);
  assert.equal((await request('/posts', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await request('/posts', post({ userId: 1, body: 'x'.repeat(9000) }))).status, 413);
  assert.equal((await request('/posts/99999')).status, 404);
  assert.equal((await request('/posts/999999999999999')).status, 400);
  assert.equal((await request('/unknown')).status, 404);
});
test('database errors return 503 and increment error count', async t => {
  const store = createStore('memory');
  store.feed = async () => { throw Error('connection failed'); };
  const request = await setup(t, 'node-cache', store);
  assert.equal((await request('/feed')).status, 503);
  assert.equal((await (await request('/metrics')).json()).errors, 1);
});
