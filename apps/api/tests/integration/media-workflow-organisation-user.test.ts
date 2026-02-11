import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app,
  cleanDatabase,
  createTestUserWithOrg,
  createTestVesselWithComponents,
  createTestWorkOrder,
  createTestUser,
  prisma,
} from '../helpers/test-app';

describe('Media, Workflow, Organisation and User APIs', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('supports media upload/get/delete', async () => {
    const ctx = await createTestUserWithOrg();
    const auth = { Authorization: `Bearer ${ctx.token}` };
    const vessel = await createTestVesselWithComponents(ctx.org.id);
    const workOrder = await createTestWorkOrder(vessel.vessel.id, ctx.org.id);

    const noFileRes = await request(app)
      .post('/api/v1/media/upload')
      .set(auth);
    expect(noFileRes.status).toBe(400);

    const uploadRes = await request(app)
      .post('/api/v1/media/upload')
      .set(auth)
      .field('workOrderId', workOrder.id)
      .attach('file', Buffer.from('fake image bytes'), {
        filename: 'evidence.png',
        contentType: 'image/png',
      });
    expect(uploadRes.status).toBe(201);
    const mediaId = uploadRes.body.data.id as string;

    const getRes = await request(app)
      .get(`/api/v1/media/${mediaId}`)
      .set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(mediaId);

    const delRes = await request(app)
      .delete(`/api/v1/media/${mediaId}`)
      .set(auth);
    expect(delRes.status).toBe(200);

    const getDeletedRes = await request(app)
      .get(`/api/v1/media/${mediaId}`)
      .set(auth);
    expect(getDeletedRes.status).toBe(404);
  });

  it('supports workflow templates and task submission flow', async () => {
    const ctx = await createTestUserWithOrg();
    const auth = { Authorization: `Bearer ${ctx.token}` };
    const vessel = await createTestVesselWithComponents(ctx.org.id);

    const workflow = await prisma.workflow.create({
      data: {
        name: 'Simple Workflow',
        isTemplate: true,
        isActive: true,
      },
    });
    const step = await prisma.workflowStep.create({
      data: {
        workflowId: workflow.id,
        name: 'Review Step',
        order: 1,
        type: 'REVIEW',
      },
    });
    const task = await prisma.workflowTask.create({
      data: {
        stepId: step.id,
        name: 'Submit Evidence',
        order: 1,
        taskType: 'FORM',
      },
    });
    const wo = await createTestWorkOrder(vessel.vessel.id, ctx.org.id, {
      workflowId: workflow.id,
      currentStepId: step.id,
    });

    const templatesRes = await request(app)
      .get('/api/v1/workflows/templates')
      .set(auth);
    expect(templatesRes.status).toBe(200);
    expect(Array.isArray(templatesRes.body.data)).toBe(true);

    const submitRes = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/tasks/${task.id}/submit`)
      .set(auth)
      .send({ data: { ok: true } });
    expect(submitRes.status).toBe(201);

    const approveRes = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/tasks/${task.id}/approve`)
      .set(auth)
      .send({ notes: 'Looks good' });
    expect(approveRes.status).toBe(200);
  });

  it('supports organisation and user admin endpoints', async () => {
    const ctx = await createTestUserWithOrg();
    const auth = { Authorization: `Bearer ${ctx.token}` };

    const listOrgRes = await request(app).get('/api/v1/organisations').set(auth);
    expect(listOrgRes.status).toBe(200);
    expect(Array.isArray(listOrgRes.body.data)).toBe(true);

    const createOrgRes = await request(app)
      .post('/api/v1/organisations')
      .set(auth)
      .send({ name: 'Created Org', type: 'SERVICE_PROVIDER' });
    expect(createOrgRes.status).toBe(201);

    const listUsersRes = await request(app).get('/api/v1/users').set(auth);
    expect(listUsersRes.status).toBe(200);
    expect(Array.isArray(listUsersRes.body.data)).toBe(true);

    const inviteUserRes = await request(app)
      .post('/api/v1/users/invite')
      .set(auth)
      .send({ email: 'new-user-invite@test.com', role: 'VIEWER' });
    expect(inviteUserRes.status).toBe(201);

    const managedUser = await createTestUser({ email: 'managed-user@test.com' });
    await prisma.organisationUser.create({
      data: {
        userId: managedUser.id,
        organisationId: ctx.org.id,
        role: 'VIEWER',
        permissions: JSON.stringify(['WORK_ORDER_VIEW']),
        isDefault: false,
      },
    });

    const updateUserRes = await request(app)
      .put(`/api/v1/users/${managedUser.id}`)
      .set(auth)
      .send({ firstName: 'Updated' });
    expect(updateUserRes.status).toBe(200);
    expect(updateUserRes.body.data.firstName).toBe('Updated');

    const patchRoleRes = await request(app)
      .patch(`/api/v1/users/${managedUser.id}/role`)
      .set(auth)
      .send({ role: 'OPERATOR', permissions: JSON.stringify(['WORK_ORDER_VIEW', 'WORK_ORDER_EDIT']) });
    expect(patchRoleRes.status).toBe(200);
  });
});
