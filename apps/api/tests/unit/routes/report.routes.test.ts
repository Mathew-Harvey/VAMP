import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reportServiceMock, workOrderServiceMock, hasAnyPermissionMock } = vi.hoisted(() => ({
  reportServiceMock: {
    generateInspectionReport: vi.fn(),
    generateWorkOrderReport: vi.fn(),
    getDocuments: vi.fn(),
  },
  workOrderServiceMock: {
    canViewWorkOrder: vi.fn(),
    getAssignmentRole: vi.fn(),
  },
  hasAnyPermissionMock: vi.fn(() => false),
}));

vi.mock('../../../src/services/report.service', () => ({ reportService: reportServiceMock }));
vi.mock('../../../src/services/work-order.service', () => ({ workOrderService: workOrderServiceMock }));
vi.mock('../../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'u-1', organisationId: 'org-1', permissions: [] };
    next();
  },
}));
vi.mock('../../../src/middleware/permissions', () => ({
  hasAnyPermission: hasAnyPermissionMock,
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

import router from '../../../src/routes/report.routes';
import { hasAnyPermission } from '../../../src/middleware/permissions';

describe('report.routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reports', router);

  beforeEach(() => {
    vi.clearAllMocks();
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(true);
    workOrderServiceMock.getAssignmentRole.mockResolvedValue('LEAD');
    reportServiceMock.generateInspectionReport.mockResolvedValue({ html: null, data: 1 });
    reportServiceMock.generateWorkOrderReport.mockResolvedValue({ id: 'wo-1' });
    reportServiceMock.getDocuments.mockResolvedValue([]);
  });

  it('generates inspection and work-order reports', async () => {
    let res = await request(app).post('/api/v1/reports/generate').send({ type: 'inspection', workOrderId: 'wo-1' });
    expect(res.status).toBe(200);

    res = await request(app).post('/api/v1/reports/generate').send({ type: 'work-order', workOrderId: 'wo-1' });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid generate payload', async () => {
    const res = await request(app).post('/api/v1/reports/generate').send({ type: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when work order inaccessible for generate', async () => {
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(false);
    const res = await request(app).post('/api/v1/reports/generate').send({ type: 'inspection', workOrderId: 'wo-1' });
    expect(res.status).toBe(404);
  });

  it('serves html preview when report has html', async () => {
    (hasAnyPermission as any).mockReturnValue(true);
    reportServiceMock.generateInspectionReport.mockResolvedValue({ html: '<h1>x</h1>' });
    const res = await request(app).get('/api/v1/reports/preview/wo-1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<h1>x</h1>');
  });

  it('returns json preview when no html', async () => {
    (hasAnyPermission as any).mockReturnValue(true);
    reportServiceMock.generateInspectionReport.mockResolvedValue({ html: null, value: 1 });
    const res = await request(app).get('/api/v1/reports/preview/wo-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when preview work order inaccessible', async () => {
    workOrderServiceMock.canViewWorkOrder.mockResolvedValue(false);
    const res = await request(app).get('/api/v1/reports/preview/wo-1');
    expect(res.status).toBe(404);
  });

  it('returns 403 when collaborator role missing for preview', async () => {
    (hasAnyPermission as any).mockReturnValue(false);
    workOrderServiceMock.getAssignmentRole.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/reports/preview/wo-1');
    expect(res.status).toBe(403);
  });

  it('returns documents and handles errors', async () => {
    const ok = await request(app).get('/api/v1/reports/documents');
    expect(ok.status).toBe(200);

    reportServiceMock.getDocuments.mockRejectedValue(new Error('boom'));
    const bad = await request(app).get('/api/v1/reports/documents');
    expect(bad.status).toBe(500);
  });

  it('handles generate and preview service errors', async () => {
    reportServiceMock.generateInspectionReport.mockRejectedValue({ statusCode: 500, code: 'ERROR', message: 'boom' });
    const generateErr = await request(app)
      .post('/api/v1/reports/generate')
      .send({ type: 'inspection', workOrderId: 'wo-1' });
    expect(generateErr.status).toBe(500);

    (hasAnyPermission as any).mockReturnValue(true);
    reportServiceMock.generateInspectionReport.mockRejectedValue({ statusCode: 500, code: 'ERROR', message: 'boom' });
    const previewErr = await request(app).get('/api/v1/reports/preview/wo-1');
    expect(previewErr.status).toBe(500);
  });

  it('handles generate and preview plain errors without statusCode', async () => {
    reportServiceMock.generateInspectionReport.mockRejectedValue(new Error('plain'));
    const generateErr = await request(app)
      .post('/api/v1/reports/generate')
      .send({ type: 'inspection', workOrderId: 'wo-1' });
    expect(generateErr.status).toBe(500);

    (hasAnyPermission as any).mockReturnValue(true);
    reportServiceMock.generateInspectionReport.mockRejectedValue(new Error('plain'));
    const previewErr = await request(app).get('/api/v1/reports/preview/wo-1');
    expect(previewErr.status).toBe(500);
  });
});
