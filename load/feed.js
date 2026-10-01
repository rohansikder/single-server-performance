import http from 'k6/http';
import { check } from 'k6';
export const options = { summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'], vus: Number(__ENV.VUS || 20), duration: __ENV.DURATION || '30s', thresholds: { http_req_duration: ['p(95)<500', 'p(99)<1000'], http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] } };
export default function () { check(http.get(`${__ENV.BASE_URL || 'http://localhost:8080'}/feed`), { 'feed succeeds': r => r.status === 200 }); }
