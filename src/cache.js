// One shared public feed; do not use this cache for personalized responses.
export function createCache({ ttl = 1000, clock = Date.now } = {}) {
  let entry;
  let pending;
  let generation = 0;
  return {
    invalidate() { entry = undefined; pending = undefined; generation++; },
    async get(load) {
      if (entry && clock() < entry.expires) return { body: entry.body, status: 'HIT' };
      if (pending) return { body: await pending, status: 'COALESCED' };
      const version = generation;
      const current = Promise.resolve().then(load).then(body => {
        if (version === generation) entry = { body, expires: clock() + ttl };
        return body;
      });
      pending = current;
      try { return { body: await current, status: 'MISS' }; }
      finally { if (pending === current) pending = undefined; }
    }
  };
}
