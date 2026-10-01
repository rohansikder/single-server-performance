import { createApp } from './app.js';
import { createStore } from './store.js';
const source = process.env.DATA_SOURCE || 'postgres';
const store = createStore(source);
const server = createApp({ store, source, mode: process.env.MODE || 'baseline', ttl: Number(process.env.CACHE_TTL_MS || 1000) });
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Performance lab listening on port ${process.env.PORT || 3000}; source=${source}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await store.close(); process.exit(0); }));
