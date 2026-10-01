import assert from 'node:assert/strict';
const mode = process.argv[2] || 'baseline';
const base = process.env.BASE_URL || 'http://localhost:8080';
const get = path => fetch(`${base}${path}`);
let healthy = false;
for (let i = 0; i < 30; i++) {
  try { if ((await get('/health')).ok) { healthy = true; break; } } catch {}
  await new Promise(r => setTimeout(r, 500));
}
assert.ok(healthy, 'stack became healthy');
const first = await get('/feed');
assert.equal(first.status, 200);
assert.equal((await first.json()).posts.length, 20);
const second = await get('/feed');
if (mode === 'node-cache') assert.equal(second.headers.get('x-app-cache'), 'HIT');
else if (mode === 'nginx-cache') {
  assert.equal(second.headers.get('x-proxy-cache'), 'HIT');
  const authorized = await fetch(`${base}/feed`, { headers: { Authorization: 'Bearer local-test' } });
  assert.equal(authorized.headers.get('x-proxy-cache'), 'BYPASS');
  const probe = `/feed?expiry_probe=${Date.now()}`;
  await get(probe);
  // Nginx uses whole-second expiry timestamps; allow an extra second.
  await new Promise(r => setTimeout(r, 2200));
  const expired = await get(probe);
  assert.equal(expired.headers.get('x-proxy-cache'), 'EXPIRED');
}
else assert.equal(second.headers.get('x-app-cache'), 'BYPASS');
console.log(`${mode}: health, seeded feed, and cache headers passed`);
