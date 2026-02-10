import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg, createTestVesselWithComponents, createTestWorkOrder } from '../helpers/test-app';

describe('Work Order API', () => {
  let token: string;
  let orgId: string;
  let vesselId: string;
  let components: any[];

  beforeEach(async () => {
    await cleanDatabase();
    const ctx = await createTestUserWithOrg();
    token = ctx.token;
    orgId = ctx.org.id;
    const v = await createTestVesselWithComponents(orgId);
    vesselId = v.vessel.id;
    components = v.components;
  });

  describe('POST /api/v1/work-orders', () => {
    it('should create a work order', async () => {
      const res = await request(app)
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ vesselId, title: 'Inspection WO', type: 'BIOFOULING_INSPECTION' });

      expect(res.status).toBe(201);
      expect(res.body.data.referenceNumber).toMatch(/^WO-/);
      expect(res.body.data.status).toBe('DRAFT');
    });
  });

  describe('PATCH /api/v1/work-orders/:id/status', () => {
    it('should transition status from DRAFT to PENDING_APPROVAL', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      const res = await request(app)
        .patch(`/api/v1/work-orders/${wo.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PENDING_APPROVAL' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
    });

    it('should reject invalid transition', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      const res = await request(app)
        .patch(`/api/v1/work-orders/${wo.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(400);
    });
  });

  describe('Work Form', () => {
    it('should generate form entries from vessel components', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      const res = await request(app)
        .post(`/api/v1/work-orders/${wo.id}/form/generate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.data.length).toBe(3); // 3 components
    });

    it('should return existing form on duplicate generate', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      await request(app).post(`/api/v1/work-orders/${wo.id}/form/generate`).set('Authorization', `Bearer ${token}`);
      const res = await request(app).post(`/api/v1/work-orders/${wo.id}/form/generate`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.data.length).toBe(3); // Same 3 entries
    });

    it('should get form entries with component details', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      await request(app).post(`/api/v1/work-orders/${wo.id}/form/generate`).set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get(`/api/v1/work-orders/${wo.id}/form`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].vesselComponent).toBeDefined();
      expect(res.body.data[0].vesselComponent.name).toBeDefined();
    });

    it('should update a form entry', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      const gen = await request(app).post(`/api/v1/work-orders/${wo.id}/form/generate`).set('Authorization', `Bearer ${token}`);
      const entryId = gen.body.data[0].id;

      const res = await request(app)
        .put(`/api/v1/form-entries/${entryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ condition: 'GOOD', foulingRating: 2, notes: 'Light slime observed', status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.data.condition).toBe('GOOD');
      expect(res.body.data.foulingRating).toBe(2);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.completedAt).toBeDefined();
    });

    it('should get form data as JSON for report generation', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      await request(app).post(`/api/v1/work-orders/${wo.id}/form/generate`).set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get(`/api/v1/work-orders/${wo.id}/form/json`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workOrder.referenceNumber).toBeDefined();
      expect(res.body.data.vessel.name).toBeDefined();
      expect(res.body.data.entries.length).toBe(3);
      expect(res.body.data.entries[0].component).toBeDefined();
      expect(res.body.data.generatedAt).toBeDefined();
    });
  });

  describe('Work Order full lifecycle', () => {
    it('should complete full DRAFT → COMPLETED lifecycle', async () => {
      const wo = await createTestWorkOrder(vesselId, orgId);
      const auth = { Authorization: `Bearer ${token}` };

      // Generate form
      await request(app).post(`/api/v1/work-orders/${wo.id}/form/generate`).set(auth);

      // DRAFT → PENDING_APPROVAL
      let res = await request(app).patch(`/api/v1/work-orders/${wo.id}/status`).set(auth).send({ status: 'PENDING_APPROVAL' });
      expect(res.body.data.status).toBe('PENDING_APPROVAL');

      // PENDING_APPROVAL → APPROVED
      res = await request(app).patch(`/api/v1/work-orders/${wo.id}/status`).set(auth).send({ status: 'APPROVED' });
      expect(res.body.data.status).toBe('APPROVED');

      // APPROVED → IN_PROGRESS
      res = await request(app).patch(`/api/v1/work-orders/${wo.id}/status`).set(auth).send({ status: 'IN_PROGRESS' });
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.actualStart).toBeDefined();

      // Fill form entries
      const form = await request(app).get(`/api/v1/work-orders/${wo.id}/form`).set(auth);
      for (const entry of form.body.data) {
        await request(app).put(`/api/v1/form-entries/${entry.id}`).set(auth)
          .send({ condition: 'GOOD', foulingRating: 1, status: 'COMPLETED' });
      }

      // IN_PROGRESS → AWAITING_REVIEW
      res = await request(app).patch(`/api/v1/work-orders/${wo.id}/status`).set(auth).send({ status: 'AWAITING_REVIEW' });
      expect(res.body.data.status).toBe('AWAITING_REVIEW');

      // AWAITING_REVIEW → UNDER_REVIEW
      res = await request(app).patch(`/api/v1/work-orders/${wo.id}/status`).set(auth).send({ status: 'UNDER_REVIEW' });
      expect(res.body.data.status).toBe('UNDER_REVIEW');

      // UNDER_REVIEW → COMPLETED
      res = await request(app).patch(`/api/v1/work-orders/${wo.id}/status`).set(auth).send({ status: 'COMPLETED' });
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.completedAt).toBeDefined();
    });
  });
});
