import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg, createTestVessel, createTestVesselWithComponents } from '../helpers/test-app';

describe('Vessel API', () => {
  let token: string;
  let orgId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const ctx = await createTestUserWithOrg();
    token = ctx.token;
    orgId = ctx.org.id;
  });

  describe('GET /api/v1/vessels', () => {
    it('should list vessels', async () => {
      await createTestVessel(orgId);
      const res = await request(app).get('/api/v1/vessels').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should return empty list when no vessels', async () => {
      const res = await request(app).get('/api/v1/vessels').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('POST /api/v1/vessels', () => {
    it('should create a vessel', async () => {
      const res = await request(app)
        .post('/api/v1/vessels')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Ship', vesselType: 'TUG' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Ship');
    });

    it('should reject without auth', async () => {
      const res = await request(app).post('/api/v1/vessels').send({ name: 'X', vesselType: 'TUG' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/vessels/:id', () => {
    it('should get vessel detail with components', async () => {
      const { vessel, components } = await createTestVesselWithComponents(orgId);
      const res = await request(app).get(`/api/v1/vessels/${vessel.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(vessel.name);
      expect(res.body.data.components.length).toBe(3);
    });

    it('should return 404 for non-existent vessel', async () => {
      const res = await request(app).get('/api/v1/vessels/nonexistent').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Vessel Components', () => {
    it('should list vessel components', async () => {
      const { vessel, components } = await createTestVesselWithComponents(orgId);
      const res = await request(app).get(`/api/v1/vessels/${vessel.id}/components`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });

    it('should add a component', async () => {
      const vessel = await createTestVessel(orgId);
      const res = await request(app)
        .post(`/api/v1/vessels/${vessel.id}/components`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Component', category: 'HULL', location: 'Bottom' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Component');
    });
  });
});
