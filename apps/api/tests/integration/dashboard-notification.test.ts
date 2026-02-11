import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg, prisma } from '../helpers/test-app';

describe('Dashboard and Notification APIs', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns dashboard summary endpoints', async () => {
    const ctx = await createTestUserWithOrg();
    const auth = { Authorization: `Bearer ${ctx.token}` };

    const overview = await request(app).get('/api/v1/dashboard/overview').set(auth);
    expect(overview.status).toBe(200);
    expect(overview.body.success).toBe(true);
    expect(overview.body.data.fleet).toBeDefined();

    const workOrders = await request(app).get('/api/v1/dashboard/work-orders').set(auth);
    expect(workOrders.status).toBe(200);
    expect(workOrders.body.success).toBe(true);

    const recent = await request(app).get('/api/v1/dashboard/recent-activity').set(auth);
    expect(recent.status).toBe(200);
    expect(recent.body.success).toBe(true);
    expect(Array.isArray(recent.body.data)).toBe(true);
  });

  it('supports notification list/count/mark-read', async () => {
    const ctx = await createTestUserWithOrg();
    const auth = { Authorization: `Bearer ${ctx.token}` };

    const notification = await prisma.notification.create({
      data: {
        userId: ctx.user.id,
        type: 'SYSTEM',
        title: 'Test',
        message: 'Test notification',
      },
    });

    const listRes = await request(app).get('/api/v1/notifications').set(auth);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    const countRes = await request(app).get('/api/v1/notifications/count').set(auth);
    expect(countRes.status).toBe(200);
    expect(countRes.body.data.count).toBeGreaterThanOrEqual(1);

    const readRes = await request(app)
      .patch(`/api/v1/notifications/${notification.id}/read`)
      .set(auth);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.isRead).toBe(true);

    const unreadRes = await request(app).get('/api/v1/notifications').query({ unread: 'true' }).set(auth);
    expect(unreadRes.status).toBe(200);
  });
});
