# Benchmark worksheet

No capacity measurements have been entered yet.

Record date, CPU model/core budget, RAM, disk, Docker/Node/PostgreSQL/Nginx versions, target host, generator host, network latency, dataset sizes, DB pool size, request mix, cache TTL, warm-up duration and measurement duration.

| Mode | VUs | Req/s | p50 ms | p95 ms | p99 ms | HTTP failures % | Feed queries delta | CPU | RSS | Threshold pass? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | | | | | | | | | | |
| Node cache | | | | | | | | | | |
| Nginx microcache | | | | | | | | | | |

Repeat each configuration at least three times. Keep raw JSON outputs with hardware metadata when deliberately adding a measured result to Git. Record app `/metrics` before and after each plateau; counters reset when the app restarts. Use per-endpoint k6 tags to separate cached feed latency from uncached reads and writes. The default thresholds cover all HTTP requests in the journey.

For comparison, compute `improvement = (baseline - optimized) / baseline * 100` for latency or query reduction; compute `(optimized - baseline) / baseline * 100` for throughput. Report units and variability. A passing short trial is not evidence of hours-long stability.

Failed requests have different latency behavior; do not report “fast” responses without error rates. Keep the target and generator separated for publishable capacity conclusions. If scaling raises generator CPU to saturation, stop and increase generator capacity before interpreting the application's limit.
