import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
const journeyErrors = new Rate('journey_errors');
export const options = { summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
  vus: Number(__ENV.VUS || 50), duration: __ENV.DURATION || '60s',
  thresholds: { http_req_duration: ['p(95)<500', 'p(99)<1000'], http_req_failed: ['rate<0.01'], journey_errors: ['rate<0.01'] }
};
const base = __ENV.BASE_URL || 'http://localhost:8080';
const headers = { 'Content-Type': 'application/json' };
export default function () {
  const userId = ((__VU - 1) % Number(__ENV.MAX_USER_ID || 50000)) + 1;
  const feed = http.get(`${base}/feed`, { tags: { name: 'GET /feed' } });
  const ok = check(feed, { 'feed succeeds': r => r.status === 200 });
  journeyErrors.add(!ok);
  if (!ok) { sleep(1); return; }
  const posts = feed.json('posts');
  sleep(3 + Math.random() * 4);
  if (posts.length) {
    const id = posts[Math.floor(Math.random() * posts.length)].id;
    const post = http.get(`${base}/posts/${id}`, { tags: { name: 'GET /posts/:id' } });
    journeyErrors.add(!check(post, { 'post succeeds': r => r.status === 200 }));
    sleep(3 + Math.random() * 5);
    if (Math.random() < 0.15) {
      const like = http.post(`${base}/posts/${id}/like`, JSON.stringify({ userId }), { headers, tags: { name: 'POST /posts/:id/like' } });
      journeyErrors.add(!check(like, { 'like succeeds': r => r.status === 200 }));
    }
  }
  if (Math.random() < Number(__ENV.POST_PROBABILITY || 0.01)) {
    const created = http.post(`${base}/posts`, JSON.stringify({ userId, body: `Load-test post by user ${userId}` }), { headers, tags: { name: 'POST /posts' } });
    journeyErrors.add(!check(created, { 'create succeeds': r => r.status === 201 }));
  }
}
