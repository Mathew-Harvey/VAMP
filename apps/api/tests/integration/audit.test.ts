import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg } from '../helpers/test-app';

describe('Audit Trail', () => {
  let token: string;
  let orgId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const ctx = await createTestUserWithOrg();
    token = ctx.token;
    orgId = ctx.org.id;
  });

  it('should create audit entries for vessel operations', async () => {
    // Create a vessel (should generate audit entry)
    await request(app).post('/api/v1/vessels').set('Authorization', `Bearer ${token}`).send({ name: 'Audit Test Ship', vesselType: 'TUG' });

    const res = await request(app).get('/api/v1/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const vesselEntry = res.body.data.find((e: any) => e.entityType === 'Vessel');
    expect(vesselEntry).toBeDefined();
    expect(vesselEntry.action).toBe('CREATE');
  });

  it('should maintain hash chain integrity', async () => {
    // Create some data to generate audit entries
    await request(app).post('/api/v1/vessels').set('Authorization', `Bearer ${token}`).send({ name: 'Ship 1', vesselType: 'TUG' });
    await request(app).post('/api/v1/vessels').set('Authorization', `Bearer ${token}`).send({ name: 'Ship 2', vesselType: 'TANKER' });

    const res = await request(app).get('/api/v1/audit/verify').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.entriesChecked).toBeGreaterThan(0);
  });
});
