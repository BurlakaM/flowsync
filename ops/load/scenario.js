// k6 scenario: a realistic read-heavy mix against a database with ~60 000 tasks (ops/load/seed.sql).
//   ./ops/load/run.sh      (builds, seeds a throw-away database, runs this file, cleans up)
//
// The mix follows how the application is used: people mostly browse lists and open tasks, search often,
// comment sometimes and change a status now and then. Every request carries a `name` tag so the report
// shows one latency line per endpoint instead of one per URL.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const WORDS = ['deploy', 'login', 'invoice', 'report', 'dashboard', 'migration', 'email', 'search', 'upload', 'payment'];
const VUS = Number(__ENV.VUS || 20);

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: VUS },
        { duration: '60s', target: VUS },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    // The latency target of docs/SLO.md, overall and per endpoint. A miss fails the run, so a regression is visible.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    'http_req_duration{name:projects list}': ['p(95)<300'],
    'http_req_duration{name:project tasks}': ['p(95)<300'],
    'http_req_duration{name:task search}': ['p(95)<300'],
    'http_req_duration{name:task detail}': ['p(95)<300'],
    'http_req_duration{name:comments}': ['p(95)<300'],
    'http_req_duration{name:activity}': ['p(95)<300'],
    'http_req_duration{name:comment create}': ['p(95)<300'],
    'http_req_duration{name:task update}': ['p(95)<300'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  // One sign-in for everybody: the login endpoint has its own strict rate limit, and a token lasts 15 minutes.
  const res = http.post(
    BASE + '/api/auth/login',
    JSON.stringify({ email: 'perf1@example.test', password: 'password-123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'signed in': (r) => r.status === 201 });
  return { token: res.json('access_token') };
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (low, high) => low + Math.floor(Math.random() * (high - low + 1));

export default function (data) {
  const headers = { Authorization: 'Bearer ' + data.token, 'Content-Type': 'application/json' };
  const get = (path, name) => http.get(BASE + path, { headers, tags: { name } });
  const projectId = between(1, 40);
  const taskId = between(1, 60000);
  const roll = Math.random();

  if (roll < 0.15) {
    get('/api/projects?limit=20', 'projects list');
  } else if (roll < 0.4) {
    get(
      '/api/projects/' + projectId + '/tasks?status=' + pick(['TODO', 'IN_PROGRESS', 'DONE']) + '&limit=20&sortBy=updatedAt&order=desc',
      'project tasks',
    );
  } else if (roll < 0.55) {
    get('/api/tasks?search=' + pick(WORDS) + '&limit=20', 'task search');
  } else if (roll < 0.7) {
    get('/api/tasks/' + taskId, 'task detail');
  } else if (roll < 0.8) {
    get('/api/tasks/' + taskId + '/comments?limit=50', 'comments');
  } else if (roll < 0.88) {
    get('/api/projects/' + projectId + '/activity?limit=15', 'activity');
  } else if (roll < 0.95) {
    const res = http.post(BASE + '/api/tasks/' + taskId + '/comments', JSON.stringify({ text: 'Load test comment' }), {
      headers,
      tags: { name: 'comment create' },
    });
    check(res, { 'comment created': (r) => r.status === 201 });
  } else {
    const detail = get('/api/tasks/' + taskId, 'task detail');
    const res = http.patch(
      BASE + '/api/tasks/' + taskId,
      JSON.stringify({ version: detail.json('version'), status: pick(['TODO', 'IN_PROGRESS', 'DONE']) }),
      { headers, tags: { name: 'task update' } },
    );
    // A concurrent edit of the same task answers 409: correct behaviour, not an error of the test.
    check(res, { 'task updated': (r) => r.status === 200 || r.status === 409 });
  }
}
