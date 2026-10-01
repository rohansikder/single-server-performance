// Guard against a dashboard or generated chart payload drifting from measured inputs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const data = JSON.parse(await read('docs/assets/benchmark-data.json'));
const html = await read('docs/dashboard.html');
const embedded = html.match(/<script id="benchmark-data" type="application\/json">(.*?)<\/script>/s);
assert.ok(embedded, 'dashboard has embedded measured data');
assert.deepEqual(JSON.parse(embedded[1]), data);
assert.ok(!html.includes('__BENCHMARK_DATA__'), 'generated template is complete');
assert.equal(data.modes.length, 3);
for (const mode of data.modes) {
  const raw = JSON.parse(await read(`docs/smoke-results/${mode.key}.json`)).metrics;
  assert.equal(mode.rps, raw.http_reqs.rate);
  assert.equal(mode.requests, raw.http_reqs.count);
  assert.equal(mode.errorRate, raw.http_req_failed.value);
  for (const [name, key] of [['median', 'med'], ['p95', 'p(95)'], ['p99', 'p(99)']]) assert.equal(mode[name], raw.http_req_duration[key]);
}
for (const journey of data.journeys) {
  const raw = JSON.parse(await read(`docs/smoke-results/${journey.key}.json`)).metrics;
  assert.equal(journey.p95, raw.http_req_duration['p(95)']);
  assert.equal(journey.requests, raw.http_reqs.count);
}
console.log('All dashboard and export values match the measured k6 summaries.');
