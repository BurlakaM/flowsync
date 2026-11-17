import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';

describe('Metrics (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Prometheus text without a user token', async () => {
    const res = await request(server()).get('/api/metrics').expect(200);

    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('nodejs_eventloop_lag_seconds');
  });

  it('records requests by route pattern', async () => {
    await request(server()).get('/api/users/me').expect(401);
    await request(server()).get('/api/nope-42').expect(404);

    const res = await request(server()).get('/api/metrics').expect(200);

    expect(res.text).toMatch(
      /http_request_duration_seconds_count\{[^}]*route="\/api\/users\/me"[^}]*status_code="401"/,
    );
    expect(res.text).toContain('route="unmatched"');
    expect(res.text).not.toContain('nope-42');
  });

  it('does not count its own scrapes or health checks', async () => {
    await request(server()).get('/api/health/live').expect(200);

    const res = await request(server()).get('/api/metrics').expect(200);

    expect(res.text).not.toContain('/api/health');
    expect(res.text).not.toContain('route="/api/metrics"');
  });
});
