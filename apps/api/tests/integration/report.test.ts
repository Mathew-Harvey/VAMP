import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestOrg, createTestUser, createTestVesselWithComponents, createTestWorkOrder, prisma } from '../helpers/test-app';
import { generateAccessToken } from '../../src/config/auth';

describe('Report API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should block preview when user has no org permission and no assignment', async () => {
    const org = await createTestOrg('No Report Org');
    const vessel = await createTestVesselWithComponents(org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, org.id);
    const user = await createTestUser({ email: 'no-report-view@test.com' });

    await prisma.organisationUser.create({
      data: {
        userId: user.id,
        organisationId: org.id,
        role: 'VIEWER',
        permissions: JSON.stringify(['WORK_ORDER_VIEW']),
        isDefault: true,
      },
    });

    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      organisationId: org.id,
      role: 'VIEWER',
      permissions: ['WORK_ORDER_VIEW'],
    });

    const res = await request(app)
      .get(`/api/v1/reports/preview/${workOrder.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should not allow preview access across organisations', async () => {
    const orgA = await createTestOrg('Report Org A');
    const vesselA = await createTestVesselWithComponents(orgA.id);
    const workOrderA = await createTestWorkOrder(vesselA.vessel.id, orgA.id);

    const orgB = await createTestOrg('Report Org B');
    const userB = await createTestUser({ email: 'report-viewer-b@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: userB.id,
        organisationId: orgB.id,
        role: 'VIEWER',
        permissions: JSON.stringify(['REPORT_VIEW']),
        isDefault: true,
      },
    });

    const tokenB = generateAccessToken({
      userId: userB.id,
      email: userB.email,
      organisationId: orgB.id,
      role: 'VIEWER',
      permissions: ['REPORT_VIEW'],
    });

    const res = await request(app)
      .get(`/api/v1/reports/preview/${workOrderA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('should allow assigned collaborator from another organisation to preview report', async () => {
    const ownerOrg = await createTestOrg('Owner Org');
    const ownerVessel = await createTestVesselWithComponents(ownerOrg.id);
    const workOrder = await createTestWorkOrder(ownerVessel.vessel.id, ownerOrg.id);

    const collabOrg = await createTestOrg('Regulator Org');
    const collabUser = await createTestUser({ email: 'regulator@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: collabUser.id,
        organisationId: collabOrg.id,
        role: 'VIEWER',
        permissions: JSON.stringify([]),
        isDefault: true,
      },
    });
    await prisma.workOrderAssignment.create({
      data: {
        workOrderId: workOrder.id,
        userId: collabUser.id,
        role: 'OBSERVER',
      },
    });
    const token = generateAccessToken({
      userId: collabUser.id,
      email: collabUser.email,
      organisationId: collabOrg.id,
      role: 'VIEWER',
      permissions: [],
    });

    const res = await request(app)
      .get(`/api/v1/reports/preview/${workOrder.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should generate work-order report for authorised org user', async () => {
    const org = await createTestOrg('Reporting Org');
    const vessel = await createTestVesselWithComponents(org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, org.id);
    const user = await createTestUser({ email: 'report-generator@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: user.id,
        organisationId: org.id,
        role: 'MANAGER',
        permissions: JSON.stringify(['REPORT_GENERATE']),
        isDefault: true,
      },
    });
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      organisationId: org.id,
      role: 'MANAGER',
      permissions: ['REPORT_GENERATE'],
    });

    const res = await request(app)
      .post('/api/v1/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'work-order', workOrderId: workOrder.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(workOrder.id);
  });

  it('should reject report generation when type is invalid', async () => {
    const org = await createTestOrg('Reporting Org 2');
    const vessel = await createTestVesselWithComponents(org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, org.id);
    const user = await createTestUser({ email: 'report-generator-2@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: user.id,
        organisationId: org.id,
        role: 'MANAGER',
        permissions: JSON.stringify(['REPORT_GENERATE']),
        isDefault: true,
      },
    });
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      organisationId: org.id,
      role: 'MANAGER',
      permissions: ['REPORT_GENERATE'],
    });

    const res = await request(app)
      .post('/api/v1/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'unknown', workOrderId: workOrder.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when generating report for inaccessible work order', async () => {
    const org = await createTestOrg('Reporting Org 3');
    const user = await createTestUser({ email: 'report-generator-3@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: user.id,
        organisationId: org.id,
        role: 'MANAGER',
        permissions: JSON.stringify(['REPORT_GENERATE']),
        isDefault: true,
      },
    });
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      organisationId: org.id,
      role: 'MANAGER',
      permissions: ['REPORT_GENERATE'],
    });

    const res = await request(app)
      .post('/api/v1/reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'work-order', workOrderId: 'non-existent-id' });

    expect(res.status).toBe(404);
  });

  it('should list report documents for authorised org user', async () => {
    const org = await createTestOrg('Reporting Org 4');
    const user = await createTestUser({ email: 'report-viewer@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: user.id,
        organisationId: org.id,
        role: 'VIEWER',
        permissions: JSON.stringify(['REPORT_VIEW']),
        isDefault: true,
      },
    });
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      organisationId: org.id,
      role: 'VIEWER',
      permissions: ['REPORT_VIEW'],
    });

    const res = await request(app)
      .get('/api/v1/reports/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
