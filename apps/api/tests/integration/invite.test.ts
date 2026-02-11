import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg, createTestVesselWithComponents, createTestWorkOrder, createTestOrg, createTestUser, prisma } from '../helpers/test-app';
import { generateAccessToken } from '../../src/config/auth';

describe('Invite API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should require WORK_ORDER_ASSIGN permission', async () => {
    const org = await createTestOrg('Ops Org');
    const vessel = await createTestVesselWithComponents(org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, org.id);

    const viewer = await createTestUser({ email: 'viewer-invite@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: viewer.id,
        organisationId: org.id,
        role: 'VIEWER',
        permissions: JSON.stringify(['WORK_ORDER_VIEW']),
        isDefault: true,
      },
    });
    await prisma.workOrderAssignment.create({
      data: {
        workOrderId: workOrder.id,
        userId: viewer.id,
        role: 'TEAM_MEMBER',
      },
    });
    const viewerToken = generateAccessToken({
      userId: viewer.id,
      email: viewer.email,
      organisationId: org.id,
      role: 'VIEWER',
      permissions: ['WORK_ORDER_VIEW'],
    });

    const res = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/invite`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'invite-target@test.com', permission: 'WRITE' });

    expect(res.status).toBe(403);
  });

  it('should allow LEAD collaborator to invite another external user', async () => {
    const org = await createTestOrg('Ops Org');
    const vessel = await createTestVesselWithComponents(org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, org.id);

    const leadUser = await createTestUser({ email: 'lead-collab@test.com' });
    const leadOrg = await createTestOrg('Lead Org');
    await prisma.organisationUser.create({
      data: {
        userId: leadUser.id,
        organisationId: leadOrg.id,
        role: 'VIEWER',
        permissions: JSON.stringify([]),
        isDefault: true,
      },
    });
    await prisma.workOrderAssignment.create({
      data: {
        workOrderId: workOrder.id,
        userId: leadUser.id,
        role: 'LEAD',
      },
    });
    const leadToken = generateAccessToken({
      userId: leadUser.id,
      email: leadUser.email,
      organisationId: leadOrg.id,
      role: 'VIEWER',
      permissions: [],
    });

    const res = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/invite`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ email: 'new-external@test.com', permission: 'READ' });

    expect(res.status).toBe(201);
    expect(['invited', 'assigned', 'updated']).toContain(res.body.data.status);
  });

  it('should validate invite payload fields', async () => {
    const inviterCtx = await createTestUserWithOrg();
    const vessel = await createTestVesselWithComponents(inviterCtx.org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, inviterCtx.org.id);

    const missingFields = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/invite`)
      .set('Authorization', `Bearer ${inviterCtx.token}`)
      .send({ email: '' });
    expect(missingFields.status).toBe(400);

    const badPermission = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/invite`)
      .set('Authorization', `Bearer ${inviterCtx.token}`)
      .send({ email: 'x@test.com', permission: 'SUPER_ADMIN' });
    expect(badPermission.status).toBe(400);
  });

  it('should invite an existing user and create assignment', async () => {
    const inviterCtx = await createTestUserWithOrg();
    const vessel = await createTestVesselWithComponents(inviterCtx.org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, inviterCtx.org.id);

    const invitee = await createTestUser({ email: 'existing-invitee@test.com' });

    const res = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/invite`)
      .set('Authorization', `Bearer ${inviterCtx.token}`)
      .send({ email: invitee.email, permission: 'WRITE' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('assigned');

    const assignment = await prisma.workOrderAssignment.findUnique({
      where: {
        workOrderId_userId: {
          workOrderId: workOrder.id,
          userId: invitee.id,
        },
      },
    });
    expect(assignment).toBeTruthy();
    expect(assignment?.role).toBe('TEAM_MEMBER');
  });

  it('should reject invites to work orders in another organisation', async () => {
    const inviterCtx = await createTestUserWithOrg();

    const otherOrg = await createTestOrg('Other Org');
    const otherVessel = await createTestVesselWithComponents(otherOrg.id);
    const otherWorkOrder = await createTestWorkOrder(otherVessel.vessel.id, otherOrg.id);

    const res = await request(app)
      .post(`/api/v1/work-orders/${otherWorkOrder.id}/invite`)
      .set('Authorization', `Bearer ${inviterCtx.token}`)
      .send({ email: 'cross-org-invite@test.com', permission: 'READ' });

    expect(res.status).toBe(404);
  });
});
