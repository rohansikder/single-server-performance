# Validation performed

The following checks were run in the managed Linux workspace on 2026-10-01:

- Docker application image built successfully, with Node 22 and an optional proxy CA secret.
- Eight tests passed, including HTTP validation, TTL expiry, single-flight refresh, failed-load recovery, in-flight invalidation, and real PostgreSQL idempotent concurrent likes. PostgreSQL integration used a small seeded dataset.
- Full dataset seeding completed; SQL counts verified exactly 50,000 users, 500,000 posts and 2,000,000 likes before load-test writes.
- `EXPLAIN` confirmed the feed uses `posts_feed_idx` and an indexed author lookup.
- Baseline and Node-cache stack checks passed against PostgreSQL.
- Nginx syntax, HIT behavior, Authorization bypass, and expiry checks passed.
- All three final k6 feed smoke runs passed configured thresholds with zero HTTP failures.
- The final journey smoke run passed feed, post, like and create checks with zero HTTP failures and zero journey errors.
- Compose configuration validation passed. A GitHub Actions workflow reproduces integration and running-stack checks.

## Short feed smoke runs

These are **single 15-second runs at 20 VUs without think time or a separate warm-up**, not capacity measurements. The target services used the Compose CPU quotas (0.4 database, 0.5 application, 0.1 proxy) and 2 GiB total memory limits. The generator shared the managed host (three visible CPUs, Linux x64) with the target. Node ran in a Node 22 Docker image; PostgreSQL 16, Nginx 1.27, and k6 0.57.0 were used. Public ECR mirrors supplied base images after Docker Hub rate limiting. No separate cloud VM or hosting-cost measurement was performed.

| Mode | Requests | Req/s | Median ms | p95 ms | p99 ms | HTTP failures |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 13,335 | 884.36 | 9.30 | 75.98 | 81.55 | 0 |
| Node cache | 14,283 | 945.97 | 4.02 | 87.78 | 101.27 | 0 |
| Nginx microcache | 30,291 | 2,015.05 | 1.07 | 85.95 | 93.83 | 0 |

Raw summaries are in [docs/smoke-results](docs/smoke-results). Node caching reduced median latency in this sample but did not improve p95/p99. Short runs, CPU quotas and shared-host noise make these unsuitable for a general performance claim. The Nginx run followed a browsing smoke run that added a few posts and likes; the seed scale stayed essentially the same, but this is another reason these runs are not a controlled final benchmark.

## Journey checks and cache-lock tuning

The journey smoke used five VUs, 15 seconds of scheduling plus graceful completion, and a 50% create probability to exercise writes. The default journey script uses 1% creates; this was deliberately increased for verification.

An initial Nginx journey run produced 27 successful HTTP requests, zero HTTP failures, and p95 about 501 ms, failing the 500 ms threshold. That result was consistent with Nginx's default cache-lock polling behavior. The configuration now sets `proxy_cache_lock_timeout 100ms`: waiters that time out go upstream, trading some duplicate reads for bounded lock waiting.

The final journey run produced 26 successful requests, zero failures, p95 5.15 ms and p99 6.45 ms. Both raw summaries are retained. These tiny randomized runs had different cache warmth and scheduling; the numerical difference is not a statistically controlled estimate of the tuning benefit. The repeatable findings are the successful route checks and the explicit cache-lock wait budget.

## Visual report checks

The visual report reads the saved k6 summaries, with an automated check that every displayed data field matches its raw input. Chromium checks covered desktop and mobile layout, percentile controls, architecture selection, CSV export, live feed requests/cache counters, actual rate-curve samples, and a static report served without the API. SVG/PNG charts were generated with Matplotlib and visually inspected. These additions do not introduce new benchmark measurements.

## Remaining measurement work

The implementation and checks are complete. To establish a repeatable capacity measurement, run the longer repeated plateau protocol in the README on a dedicated target with a separate generator, record hardware and generator utilization, and save the results.
