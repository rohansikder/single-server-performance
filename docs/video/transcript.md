# Single Server Performance Lab — Video transcript

Narration: Emma, a conversational female synthetic voice at normal speed.

## One server. Three response paths.

How much work can a single server avoid? Let's run the same social feed through three configurations and see what caching actually changes.

## The experiment

Nginx receives the requests, and Node handles the API. PostgreSQL stores fifty thousand users, half a million posts, and two million likes. k six drives the workload. The target services share a fixed resource budget.

## Start with a solid baseline.

In the baseline, every feed request reaches the database. An indexed query returns the latest twenty posts and their authors. We're starting with a reasonable implementation, with no artificial slowdown.

## Cache the completed response.

Next, Node caches the completed feed response for one second. A cache hit skips the database query. Concurrent misses share a refresh, and successful writes invalidate the cache. Node still handles every request.

## Move the cache closer.

Then we move the cache to Nginx. A proxy hit skips Node entirely. Only the public feed is cached. Requests carrying Authorization or Cookie headers bypass this proxy cache.

## Measure the work avoided.

In these short runs, baseline throughput was about eight hundred eighty four requests per second. Node caching reached nine hundred forty six. Nginx reached two thousand fifteen. That's two point two eight times the baseline.

## The median is only half the story.

Median latency fell from nine point three milliseconds, to four point zero three, then one point zero eight. But both caches had higher ninety-fifth and ninety-ninth percentile latency than the baseline.

## Explore the running lab.

The dashboard puts the evidence in one place. Compare latency percentiles, explore the request paths, and send real feed requests. Live counters show feed loads and application cache hits.

## Less work. A freshness tradeoff.

Node invalidates its cache on writes. Nginx relies on expiry, so updates can appear roughly one to two seconds late. These fifteen second smoke tests ran on a shared host. So explain the tradeoffs, then repeat longer tests before claiming capacity.
