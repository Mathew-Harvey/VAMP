import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inviteServiceMock, workOrderServiceMock, hasAnyPermissionMock } = vi.hoisted(() => ({
  inviteServiceMock: {
    inviteToWorkOrder: vi.fn(),
    changePermission: vi.fn(),
    removeFromWorkOrder: vi.fn(),
  },
  workOrderServiceMock: {
    canViewWorkOrder: vi.fn(),
    canAdminAsCollaborator: vi.fn(),
  },
  hasAnyPermissionMock: vi.fn(() => false),
}));

vi.mock('../../../src/services/invite.service', () => ({ inviteService: inviteServiceMock }));
vi.mock('../../../src/services/work-order.service', () => ({ workOrderService: workOrderServiceMock }));
vi.mock('../../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'u-1', organisationId: 'org-1', permissions: [] };
    next();
  },
}));
vi.mock('../../../src/middleware/permissions', () => ({
  hasAnyPermission: hasAnyPermissionMock,
}));

import router from '../../../src/routes/invite.routes';
import { hasAnyPermission } from '../../../src/middleware/permissions';

describe('invite.routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);

  beforeEach(() => {
    vi.clearAllMocks();
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(true);
    workOrderServiceMock.canAdminAsCollaborator.mockResolvedValue(true);
    inviteServiceMock.inviteToWorkOrder.mockResolvedValue({ status: 'assigned' });
    inviteServiceMock.changePermission.mockResolvedValue({ userId: 'u-2', role: 'OBSERVER' });
    inviteServiceMock.removeFromWorkOrder.mockResolvedValue(undefined);
  });

  it('returns 400 for missing email or permission', async () => {
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid permission', async () => {
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: 'a@b.com', permission: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when work order is inaccessible', async () => {
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(false);
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: 'a@b.com', permission: 'READ' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when lacking assign/admin rights', async () => {
    (hasAnyPermission as any).mockReturnValue(false);
    workOrderServiceMock.canAdminAsCollaborator.mockResolvedValue(false);
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: 'a@b.com', permission: 'READ' });
    expect(res.status).toBe(403);
  });

  it('creates invite successfully', async () => {
    (hasAnyPermission as any).mockReturnValue(true);
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: 'a@b.com', permission: 'READ' });
    expect(res.status).toBe(201);
  });

  it('handles service errors on invite', async () => {
    (hasAnyPermission as any).mockReturnValue(true);
    inviteServiceMock.inviteToWorkOrder.mockRejectedValue({ statusCode: 500, code: 'ERROR', message: 'boom' });
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: 'a@b.com', permission: 'READ' });
    expect(res.status).toBe(500);
  });

  it('handles plain errors on invite with fallback code/status', async () => {
    (hasAnyPermission as any).mockReturnValue(true);
    inviteServiceMock.inviteToWorkOrder.mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/v1/work-orders/wo/invite').send({ email: 'a@b.com', permission: 'READ' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('ERROR');
  });

  it('updates collaborator permission and handles validation', async () => {
    const bad = await request(app).patch('/api/v1/work-orders/wo/collaborators/u/permission').send({ permission: 'X' });
    expect(bad.status).toBe(400);

    const good = await request(app).patch('/api/v1/work-orders/wo/collaborators/u/permission').send({ permission: 'READ' });
    expect(good.status).toBe(200);
  });

  it('returns 404 and 403 branches on patch permission', async () => {
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(false);
    const notFound = await request(app).patch('/api/v1/work-orders/wo/collaborators/u/permission').send({ permission: 'READ' });
    expect(notFound.status).toBe(404);

    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(true);
    (hasAnyPermission as any).mockReturnValue(false);
    workOrderServiceMock.canAdminAsCollaborator.mockResolvedValue(false);
    const forbidden = await request(app).patch('/api/v1/work-orders/wo/collaborators/u/permission').send({ permission: 'READ' });
    expect(forbidden.status).toBe(403);
  });

  it('handles patch service errors with and without statusCode', async () => {
    inviteServiceMock.changePermission.mockRejectedValue({ statusCode: 409, code: 'CONFLICT', message: 'x' });
    const typedErr = await request(app).patch('/api/v1/work-orders/wo/collaborators/u/permission').send({ permission: 'READ' });
    expect(typedErr.status).toBe(409);

    inviteServiceMock.changePermission.mockRejectedValue(new Error('boom'));
    const plainErr = await request(app).patch('/api/v1/work-orders/wo/collaborators/u/permission').send({ permission: 'READ' });
    expect(plainErr.status).toBe(500);
  });

  it('removes collaborator and handles errors', async () => {
    const ok = await request(app).delete('/api/v1/work-orders/wo/collaborators/u');
    expect(ok.status).toBe(200);

    inviteServiceMock.removeFromWorkOrder.mockRejectedValue({ statusCode: 500, code: 'ERROR', message: 'boom' });
    const bad = await request(app).delete('/api/v1/work-orders/wo/collaborators/u');
    expect(bad.status).toBe(500);
  });

  it('handles plain errors on remove collaborator with fallback code/status', async () => {
    inviteServiceMock.removeFromWorkOrder.mockRejectedValue(new Error('boom'));
    const bad = await request(app).delete('/api/v1/work-orders/wo/collaborators/u');
    expect(bad.status).toBe(500);
    expect(bad.body.error.code).toBe('ERROR');
  });

  it('returns 404 and 403 branches on delete collaborator', async () => {
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(false);
    const notFound = await request(app).delete('/api/v1/work-orders/wo/collaborators/u');
    expect(notFound.status).toBe(404);

    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(true);
    (hasAnyPermission as any).mockReturnValue(false);
    workOrderServiceMock.canAdminAsCollaborator.mockResolvedValue(false);
    const forbidden = await request(app).delete('/api/v1/work-orders/wo/collaborators/u');
    expect(forbidden.status).toBe(403);
  });
});
