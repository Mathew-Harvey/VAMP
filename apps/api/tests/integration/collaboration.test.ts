import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app,
  cleanDatabase,
  createTestOrg,
  createTestUser,
  createTestVesselWithComponents,
  createTestWorkOrder,
  prisma,
} from '../helpers/test-app';
import { generateAccessToken } from '../../src/config/auth';

function buildToken(params: {
  userId: string;
  email: string;
  organisationId: string;
  role?: string;
  permissions?: string[];
}) {
  return generateAccessToken({
    userId: params.userId,
    email: params.email,
    organisationId: params.organisationId,
    role: params.role || 'VIEWER',
    permissions: params.permissions || [],
  });
}

describe('Cross-organisation collaboration', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('allows TEAM_MEMBER collaborator to update form, add attachments, and post comments', async () => {
    const ownerOrg = await createTestOrg('Owner Org');
    const vessel = await createTestVesselWithComponents(ownerOrg.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, ownerOrg.id);

    const owner = await createTestUser({ email: 'owner-manager@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: owner.id,
        organisationId: ownerOrg.id,
        role: 'MANAGER',
        permissions: JSON.stringify(['WORK_ORDER_VIEW', 'WORK_ORDER_EDIT']),
        isDefault: true,
      },
    });
    const ownerToken = buildToken({
      userId: owner.id,
      email: owner.email,
      organisationId: ownerOrg.id,
      role: 'MANAGER',
      permissions: ['WORK_ORDER_VIEW', 'WORK_ORDER_EDIT'],
    });

    const generateRes = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/form/generate`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(generateRes.status).toBe(201);
    const entryId = generateRes.body.data[0].id as string;

    const extOrg = await createTestOrg('Regulator Org');
    const collaborator = await createTestUser({ email: 'team-member-external@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: collaborator.id,
        organisationId: extOrg.id,
        role: 'VIEWER',
        permissions: JSON.stringify([]),
        isDefault: true,
      },
    });
    await prisma.workOrderAssignment.create({
      data: {
        workOrderId: workOrder.id,
        userId: collaborator.id,
        role: 'TEAM_MEMBER',
      },
    });
    const collaboratorToken = buildToken({
      userId: collaborator.id,
      email: collaborator.email,
      organisationId: extOrg.id,
    });

    const getFormRes = await request(app)
      .get(`/api/v1/work-orders/${workOrder.id}/form`)
      .set('Authorization', `Bearer ${collaboratorToken}`);
    expect(getFormRes.status).toBe(200);

    const updateRes = await request(app)
      .put(`/api/v1/form-entries/${entryId}`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .send({ notes: 'External collaborator update', status: 'COMPLETED' });
    expect(updateRes.status).toBe(200);

    const attachRes = await request(app)
      .post(`/api/v1/form-entries/${entryId}/attachments`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .send({ mediaId: 'media-external-1' });
    expect(attachRes.status).toBe(200);

    const commentRes = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/comments`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .send({ content: 'Regulator note added' });
    expect(commentRes.status).toBe(201);
  });

  it('allows OBSERVER collaborator to view but not modify form/comments', async () => {
    const ownerOrg = await createTestOrg('Owner Org');
    const vessel = await createTestVesselWithComponents(ownerOrg.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, ownerOrg.id);

    const owner = await createTestUser({ email: 'owner-manager-2@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: owner.id,
        organisationId: ownerOrg.id,
        role: 'MANAGER',
        permissions: JSON.stringify(['WORK_ORDER_VIEW', 'WORK_ORDER_EDIT']),
        isDefault: true,
      },
    });
    const ownerToken = buildToken({
      userId: owner.id,
      email: owner.email,
      organisationId: ownerOrg.id,
      role: 'MANAGER',
      permissions: ['WORK_ORDER_VIEW', 'WORK_ORDER_EDIT'],
    });
    const generated = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/form/generate`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const entryId = generated.body.data[0].id as string;

    const extOrg = await createTestOrg('Observer Org');
    const observer = await createTestUser({ email: 'observer-external@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: observer.id,
        organisationId: extOrg.id,
        role: 'VIEWER',
        permissions: JSON.stringify([]),
        isDefault: true,
      },
    });
    await prisma.workOrderAssignment.create({
      data: {
        workOrderId: workOrder.id,
        userId: observer.id,
        role: 'OBSERVER',
      },
    });
    const observerToken = buildToken({
      userId: observer.id,
      email: observer.email,
      organisationId: extOrg.id,
    });

    const getFormRes = await request(app)
      .get(`/api/v1/work-orders/${workOrder.id}/form`)
      .set('Authorization', `Bearer ${observerToken}`);
    expect(getFormRes.status).toBe(200);

    const getCommentsRes = await request(app)
      .get(`/api/v1/work-orders/${workOrder.id}/comments`)
      .set('Authorization', `Bearer ${observerToken}`);
    expect(getCommentsRes.status).toBe(200);

    const generateRes = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/form/generate`)
      .set('Authorization', `Bearer ${observerToken}`);
    expect(generateRes.status).toBe(403);

    const updateRes = await request(app)
      .put(`/api/v1/form-entries/${entryId}`)
      .set('Authorization', `Bearer ${observerToken}`)
      .send({ notes: 'Should fail' });
    expect(updateRes.status).toBe(403);

    const commentRes = await request(app)
      .post(`/api/v1/work-orders/${workOrder.id}/comments`)
      .set('Authorization', `Bearer ${observerToken}`)
      .send({ content: 'Should fail' });
    expect(commentRes.status).toBe(403);
  });

  it('allows LEAD collaborator to change permissions and remove collaborators', async () => {
    const ownerOrg = await createTestOrg('Owner Org');
    const vessel = await createTestVesselWithComponents(ownerOrg.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, ownerOrg.id);

    const leadOrg = await createTestOrg('Lead Org');
    const leadUser = await createTestUser({ email: 'lead-external@test.com' });
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
    const leadToken = buildToken({
      userId: leadUser.id,
      email: leadUser.email,
      organisationId: leadOrg.id,
    });

    const memberOrg = await createTestOrg('Member Org');
    const memberUser = await createTestUser({ email: 'member-external@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: memberUser.id,
        organisationId: memberOrg.id,
        role: 'VIEWER',
        permissions: JSON.stringify([]),
        isDefault: true,
      },
    });
    await prisma.workOrderAssignment.create({
      data: {
        workOrderId: workOrder.id,
        userId: memberUser.id,
        role: 'TEAM_MEMBER',
      },
    });

    const patchRes = await request(app)
      .patch(`/api/v1/work-orders/${workOrder.id}/collaborators/${memberUser.id}/permission`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ permission: 'READ' });
    expect(patchRes.status).toBe(200);

    const updatedAssignment = await prisma.workOrderAssignment.findUnique({
      where: { workOrderId_userId: { workOrderId: workOrder.id, userId: memberUser.id } },
    });
    expect(updatedAssignment?.role).toBe('OBSERVER');

    const removeRes = await request(app)
      .delete(`/api/v1/work-orders/${workOrder.id}/collaborators/${memberUser.id}`)
      .set('Authorization', `Bearer ${leadToken}`);
    expect(removeRes.status).toBe(200);

    const deletedAssignment = await prisma.workOrderAssignment.findUnique({
      where: { workOrderId_userId: { workOrderId: workOrder.id, userId: memberUser.id } },
    });
    expect(deletedAssignment).toBeNull();
  });
});
