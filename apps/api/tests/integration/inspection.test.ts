import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg, createTestVesselWithComponents, createTestWorkOrder } from '../helpers/test-app';

describe('Inspection API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('supports full inspection lifecycle with findings', async () => {
    const ctx = await createTestUserWithOrg();
    const vessel = await createTestVesselWithComponents(ctx.org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, ctx.org.id);
    const auth = { Authorization: `Bearer ${ctx.token}` };

    const createRes = await request(app)
      .post('/api/v1/inspections')
      .set(auth)
      .send({
        workOrderId: workOrder.id,
        vesselId: vessel.vessel.id,
        type: 'BIOFOULING_INSPECTION',
        inspectorName: 'Lead Diver',
        location: 'Brisbane',
      });
    expect(createRes.status).toBe(201);
    const inspectionId = createRes.body.data.id as string;

    const listRes = await request(app)
      .get('/api/v1/inspections')
      .set(auth)
      .query({ vesselId: vessel.vessel.id });
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(inspectionId);

    const updateRes = await request(app)
      .put(`/api/v1/inspections/${inspectionId}`)
      .set(auth)
      .send({ inspectorName: 'Updated Diver' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.inspectorName).toBe('Updated Diver');

    const addFindingRes = await request(app)
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set(auth)
      .send({ area: 'Sea chest', foulingRating: 2, actionRequired: false, priority: 'NORMAL' });
    expect(addFindingRes.status).toBe(201);
    const findingId = addFindingRes.body.data.id as string;

    const updateFindingRes = await request(app)
      .put(`/api/v1/inspections/${inspectionId}/findings/${findingId}`)
      .set(auth)
      .send({ description: 'Moderate growth' });
    expect(updateFindingRes.status).toBe(200);

    const completeRes = await request(app)
      .patch(`/api/v1/inspections/${inspectionId}/complete`)
      .set(auth);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('COMPLETED');

    const approveRes = await request(app)
      .patch(`/api/v1/inspections/${inspectionId}/approve`)
      .set(auth);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });
});
