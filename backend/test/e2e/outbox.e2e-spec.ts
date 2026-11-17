import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENT } from '../../src/common/events/domain-event';
import { DomainEventsService } from '../../src/common/events/domain-events.service';
import { OutboxRelayService } from '../../src/common/events/outbox-relay.service';
import { Api, TestUser, createApi } from '../utils/api';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';

/** The relay waits for `nextAttemptAt`; tests skip the wait by moving it into the past. */
const makeDue = (api: Api) =>
  api.prisma.outboxEvent.updateMany({
    where: { status: 'PENDING' },
    data: { nextAttemptAt: new Date(Date.now() - 1000) },
  });

/** `claim` and `deliver` are private: reaching them is how a test plays "the process died here". */
type Internals = {
  claim: () => Promise<unknown[]>;
  deliver: () => Promise<void>;
};

describe('Transactional outbox (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let events: DomainEventsService;
  let relay: OutboxRelayService;
  let emitter: EventEmitter2;
  let owner: TestUser;
  let member: TestUser;
  let projectId: number;

  const createTask = async (name: string, assigneeIds: number[] = []) =>
    (
      await api
        .post(`/api/projects/${projectId}/tasks`, owner, { name, assigneeIds })
        .expect(201)
    ).body;
  const audited = async () =>
    (await api.prisma.auditLog.findMany({ where: { projectId } })).map(
      (row) => `${row.type}:${row.entityId}`,
    );
  const pending = () =>
    api.prisma.outboxEvent.count({ where: { status: 'PENDING' } });

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    events = app.get(DomainEventsService);
    relay = app.get(OutboxRelayService);
    emitter = app.get(EventEmitter2);
  });

  beforeEach(async () => {
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    projectId = (
      await api.post('/api/projects', owner, { name: 'Outbox' }).expect(201)
    ).body.id;
    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('stores the event with the change and marks it delivered', async () => {
    const task = await createTask('Normal');

    const rows = await api.prisma.outboxEvent.findMany({
      where: { type: 'task.created' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'DONE', lastError: null });
    expect(await audited()).toContain(`task.created:${task.id}`);
  });

  describe('a crash right after the commit', () => {
    it('loses nothing: the relay delivers the event that nobody claimed', async () => {
      // The process "dies" before it can deliver: no claim is made, so the event stays in the outbox.
      vi.spyOn(events as unknown as Internals, 'claim').mockResolvedValueOnce(
        [],
      );

      const task = await createTask('Crashed');

      // The change is saved, the audit row is not there yet, the event waits.
      await api.get(`/api/tasks/${task.id}`, owner).expect(200);
      expect(await audited()).not.toContain(`task.created:${task.id}`);
      expect(await pending()).toBe(1);

      await relay.runOnce();

      expect(await audited()).toContain(`task.created:${task.id}`);
      expect(await pending()).toBe(0);
    });

    it('recovers an event whose delivery died half way once its lease runs out', async () => {
      // Claimed (the lease starts) but the process dies before the subscribers run.
      vi.spyOn(events as unknown as Internals, 'deliver').mockResolvedValueOnce(
        undefined,
      );
      const task = await createTask('Half way');

      // Still leased: another worker must not take it yet.
      expect(await relay.runOnce()).toBe(0);
      expect(await audited()).not.toContain(`task.created:${task.id}`);

      await makeDue(api);
      expect(await relay.runOnce()).toBe(1);

      expect(await audited()).toContain(`task.created:${task.id}`);
    });
  });

  describe('a failing subscriber', () => {
    it('does not fail the request, is retried and then succeeds', async () => {
      const failing = vi.fn().mockRejectedValue(new Error('mail server down'));
      emitter.on(DOMAIN_EVENT, failing);

      const task = await createTask('Flaky');

      emitter.off(DOMAIN_EVENT, failing);
      const row = await api.prisma.outboxEvent.findFirstOrThrow({
        where: { type: 'task.created' },
      });
      expect(row).toMatchObject({
        status: 'PENDING',
        attempts: 1,
        lastError: 'mail server down',
      });
      // Backed off: not due again immediately.
      expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      expect(await relay.runOnce()).toBe(0);

      await makeDue(api);
      await relay.runOnce();

      expect(
        await api.prisma.outboxEvent.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({ status: 'DONE', attempts: 2, lastError: null });
      expect(await audited()).toContain(`task.created:${task.id}`);
    });

    it('gives up after the last attempt and parks the event as DEAD', async () => {
      const failing = vi.fn().mockRejectedValue(new Error('always broken'));
      emitter.on(DOMAIN_EVENT, failing);
      let calls = 0;
      try {
        await createTask('Hopeless');
        for (let attempt = 2; attempt <= 8; attempt += 1) {
          await makeDue(api);
          await relay.runOnce();
        }
        calls = failing.mock.calls.length;

        // A dead event is never retried on its own.
        await makeDue(api);
        await relay.runOnce();
        expect(failing.mock.calls.length).toBe(calls);
      } finally {
        // A leftover subscriber would break every later test.
        emitter.off(DOMAIN_EVENT, failing);
      }

      const row = await api.prisma.outboxEvent.findFirstOrThrow({
        where: { type: 'task.created' },
      });
      expect(row).toMatchObject({
        status: 'DEAD',
        attempts: 8,
        lastError: 'always broken',
      });
    });
  });

  describe('redelivery', () => {
    it('writes one audit row and one notification however often an event arrives', async () => {
      const task = await createTask('Assigned', [member.id]);
      const row = await api.prisma.outboxEvent.findFirstOrThrow({
        where: { type: 'task.created' },
      });
      const delivered = { ...(row.payload as object), id: row.id };

      await emitter.emitAsync(DOMAIN_EVENT, delivered);
      await emitter.emitAsync(DOMAIN_EVENT, delivered);

      const mine = (await audited()).filter(
        (item) => item === `task.created:${task.id}`,
      );
      expect(mine).toHaveLength(1);
      expect(
        await api.prisma.notification.count({
          where: { userId: member.id, type: 'task.assigned' },
        }),
      ).toBe(1);
    });
  });

  describe('atomicity', () => {
    it('stores no event when the request is refused', async () => {
      const before = await api.prisma.outboxEvent.count();

      await api
        .del(`/api/projects/${projectId}/members/999999`, owner)
        .expect(404);

      expect(await api.prisma.outboxEvent.count()).toBe(before);
    });

    it('rolls the change back together with its event when the work fails', async () => {
      const tagsBefore = await api.prisma.tag.count();
      const eventsBefore = await api.prisma.outboxEvent.count();

      await expect(
        events.transact(async (tx, emit) => {
          const tag = await tx.tag.create({
            data: { name: 'ghost', projectId },
          });
          emit({
            type: 'tag.created',
            actorId: owner.id,
            projectId,
            entityType: 'Tag',
            entityId: tag.id,
            data: { name: tag.name },
          });
          throw new Error('crash before commit');
        }),
      ).rejects.toThrow('crash before commit');

      expect(await api.prisma.tag.count()).toBe(tagsBefore);
      expect(await api.prisma.outboxEvent.count()).toBe(eventsBefore);
    });
  });

  describe('several workers', () => {
    it('never take the same event twice', async () => {
      for (let index = 0; index < 6; index += 1) {
        await api.prisma.outboxEvent.create({
          data: {
            type: 'tag.created',
            payload: {
              type: 'tag.created',
              actorId: owner.id,
              projectId,
              entityType: 'Tag',
              entityId: index + 100,
              data: { name: `t${index}` },
            },
          },
        });
      }
      const seen: string[] = [];
      const listener = (event: { id: string }) => {
        seen.push(event.id);
      };
      emitter.on(DOMAIN_EVENT, listener);

      const handled = await Promise.all([
        events.deliverDue(3),
        events.deliverDue(3),
        events.deliverDue(3),
        events.deliverDue(3),
      ]);

      emitter.off(DOMAIN_EVENT, listener);
      expect(handled.reduce((sum, count) => sum + count, 0)).toBe(6);
      expect(new Set(seen).size).toBe(seen.length);
    });
  });
});
