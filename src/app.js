import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createCache } from './cache.js';
const dashboard = await readFile(new URL('../docs/dashboard.html', import.meta.url));
export function createApp({ store, mode = 'baseline', ttl = 1000, source = 'postgres' }) {
  if (!['baseline', 'node-cache'].includes(mode)) throw new Error('MODE must be baseline or node-cache');
  const cache = createCache({ ttl });
  const metrics = { requests: 0, errors: 0, feedQueries: 0, cacheHits: 0, cacheMisses: 0, coalesced: 0 };
  const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  async function parse(req) {
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 8192) throw Object.assign(new Error('Body too large'), { status: 413 }); }
    try { return JSON.parse(body); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
  }
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  return http.createServer(async (req, res) => {
    metrics.requests++;
    const path = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && path === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(dashboard); }
      if (req.method === 'GET' && path === '/health') { await store.health(); return send(res, 200, { status: 'ok' }); }
      if (req.method === 'GET' && path === '/metrics') return send(res, 200, { mode, source, ttl, ...metrics, uptime: process.uptime(), rssBytes: process.memoryUsage().rss }, { 'Cache-Control': 'no-store' });
      if (req.method === 'GET' && path === '/feed') {
        const load = async () => { metrics.feedQueries++; return JSON.stringify({ posts: await store.feed() }); };
        const result = mode === 'node-cache' ? await cache.get(load) : { body: await load(), status: 'BYPASS' };
        if (result.status === 'HIT') metrics.cacheHits++;
        if (result.status === 'MISS') metrics.cacheMisses++;
        if (result.status === 'COALESCED') metrics.coalesced++;
        return send(res, 200, result.body, { 'X-App-Cache': result.status, 'Cache-Control': 'public, max-age=0' });
      }
      const match = path.match(/^\/posts\/(\d+)(\/like)?$/);
      if (match && !validId(Number(match[1]))) return send(res, 400, { error: 'Invalid post ID' });
      if (req.method === 'GET' && match && !match[2]) { const post = await store.post(Number(match[1])); return send(res, post ? 200 : 404, post || { error: 'Post not found' }); }
      if (req.method === 'POST' && (path === '/posts' || match?.[2])) {
        const data = await parse(req);
        if (!validId(data.userId)) return send(res, 400, { error: 'A positive integer userId is required' });
        if (path === '/posts' && (typeof data.body !== 'string' || !data.body.trim() || data.body.length > 1000)) return send(res, 400, { error: 'body must contain 1–1000 characters' });
        const post = path === '/posts' ? await store.create(data.userId, data.body.trim()) : await store.like(Number(match[1]), data.userId);
        if (!post) return send(res, 404, { error: 'Post not found' });
        cache.invalidate();
        return send(res, path === '/posts' ? 201 : 200, post, { 'Cache-Control': 'no-store' });
      }
      return send(res, 404, { error: 'Not found' });
    } catch (error) {
      metrics.errors++;
      const status = error.status || (error.code === '23503' ? 400 : 503);
      send(res, status, { error: status === 503 ? 'Service unavailable' : error.code === '23503' ? 'Unknown userId' : error.message });
    }
  });
}
