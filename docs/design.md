# Design rationale

This lab compares three ways to serve the same public social feed: an indexed database query on every request, a short-lived cache inside Node.js, and a short-lived cache at Nginx. The comparison shows which work each cache avoids and what freshness guarantees it gives up.

## Start with an efficient baseline

The feed query selects the latest 20 posts and joins their authors. An ordered index supports the feed lookup, and stored like counts avoid aggregating the likes table on every read. Caching is evaluated against this reasonable baseline rather than an intentionally slow query.

Likes use a unique `(post_id, user_id)` key. Atomic insertion and counter updates make repeated likes idempotent, including concurrent requests. Cache behavior is separate from this database correctness guarantee.

## Choose a small freshness budget

The one-second TTL is an experiment setting for a shared public feed. The appropriate freshness requirement depends on the product; payments, permission changes and other sensitive state need different consistency rules.

The Node cache stores completed feed JSON inside one process. Its TTL begins when the load completes. A hit avoids the database query, while Node still handles the HTTP request and response. Concurrent misses in the same cache generation share one pending load, and failed loads are not cached.

Successful writes invalidate the Node cache. A generation guard prevents an older in-flight read from repopulating it after invalidation. That read can still finish and return its result to requests already waiting for it; invalidation does not cancel in-flight responses. Multiple Node processes would need an additional strategy for coordinating invalidation.

A cache hit at Nginx returns the stored feed response without running Node or PostgreSQL. This removes application work as well as database work. The proxy can still be limited by CPU, connections, bandwidth or other host resources.

Nginx caches successful feed responses with a one-second TTL and has no write invalidation. Whole-second expiry granularity means posts or likes can appear roughly one to two seconds late, plus query and network time. This is a freshness tradeoff, not an exact one-second update guarantee.

## Limit cache scope

Only the shared public feed is cached. Post reads and writes continue upstream. Nginx bypasses its cache for requests carrying Authorization or Cookie headers; this bypass is not an authentication implementation.

A global cache cannot be reused for personalized or permission-dependent feeds. Such responses need cache keys and invalidation rules that preserve authorization and personalization boundaries. The current Node cache is appropriate because its feed response is public and identical for every caller.

## Prevent refresh bursts without hiding waiting costs

An expired key can make many requests refill the same data at once. Node shares a pending promise to coalesce those misses. Nginx uses `proxy_cache_lock` and a `proxy_cache_lock_timeout` of 100 ms. A waiter that times out queries upstream, trading some duplicate reads for a shorter cache-lock wait budget. Upstream query time still contributes to response latency.

An initial short proxy-cache journey recorded roughly 501 ms p95 with the default lock behavior. The final configuration uses the explicit 100 ms wait budget and passed the route and error checks. Those tiny randomized runs had different scheduling and cache warmth, so their numerical difference does not establish a controlled tuning benefit. See [validation details](../VALIDATION.md).

## Explore the implementation

1. Open the results dashboard and compare throughput, median, p95 and p99. Recorded results are separate from live process counters.
2. Select the architecture paths and inspect the indexed feed query. The diagram controls illustrate request paths; they do not change the running server's mode.
3. Run the PostgreSQL stack in baseline mode. Each feed request increases `feedQueries` because it executes a feed query.
4. Run Node-cache mode and inspect `X-App-Cache`, cache-hit counters and coalesced refreshes. After a successful post or like write, inspect the next feed load to observe invalidation.
5. Run Nginx microcache mode and inspect `X-Proxy-Cache: HIT`. Proxy hits bypass Node, so they do not appear in Node's request or cache-hit counters. On a proxy hit, `X-App-Cache` is a stored upstream header rather than evidence that Node ran.
6. Export the recorded CSV and compare it with the saved k6 summaries. Capture counters, resource usage, latency percentiles and failures when running additional experiments.

The memory demo supports the dashboard without PostgreSQL. In that mode, `feedQueries` counts memory-store feed loads rather than SQL queries. Browser timings and live curves are separate from the recorded PostgreSQL benchmark samples.

## Interpret measurements carefully

The checked-in feed results are single 15-second smoke runs at 20 virtual users, without a dedicated warm-up, on a shared target and generator host. Median latency improved in the cached samples, but both caches had higher p95 and p99 latency than baseline. These observations do not establish production capacity or a general improvement in tail latency.

Virtual users represent concurrent simulated sessions, not requests per second or registered accounts. Think time and journey steps change the request rate produced by a given virtual-user count. Report throughput, latency and failures together, and compare the same workload across modes.

For capacity measurements, warm up each mode, use longer repeated plateaus and run the generator separately. Record hardware, generator utilization, request mix and raw outputs. Require p95 below 500 ms, p99 below 1,000 ms and HTTP failures below 1%, then report the highest repeatably passing plateau. A shared or saturated generator can distort the apparent application limit. Use the [benchmark worksheet](benchmark.md) to record the experiment.

The lab deliberately starts with a single target stack. Shared cache services or additional orchestration should address a measured coordination or capacity need, with their own operational and network costs included in the comparison.
