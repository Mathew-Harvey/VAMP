import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, auditServiceMock } = vi.hoisted(() => ({
  prismaMock: {
    workOrder: { findFirst: vi.fn() },
    workFormEntry: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  auditServiceMock: { log: vi.fn() },
}));

vi.mock('../../../src/config/database', () => ({ default: prismaMock }));
vi.mock('../../../src/services/audit.service', () => ({ auditService: auditServiceMock }));

import { workFormService } from '../../../src/services/work-form.service';
import { AppError } from '../../../src/middleware/error';

describe('workFormService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when work order does not exist', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue(null);
    await expect(workFormService.generateForm('wo-1', 'u-1')).rejects.toBeInstanceOf(AppError);
  });

  it('throws when vessel has no components', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      vessel: { name: 'Vessel', components: [] },
    });
    await expect(workFormService.generateForm('wo-1', 'u-1')).rejects.toBeInstanceOf(AppError);
  });

  it('returns existing form entries when already generated', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      vessel: { name: 'Vessel', components: [{ id: 'c-1' }] },
    });
    prismaMock.workFormEntry.findMany.mockResolvedValue([{ id: 'e-1' }]);

    const result = await workFormService.generateForm('wo-1', 'u-1');
    expect(result).toEqual([{ id: 'e-1' }]);
    expect(prismaMock.workFormEntry.create).not.toHaveBeenCalled();
  });

  it('creates entries and logs audit when generating new form', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      vessel: { name: 'Vessel A', components: [{ id: 'c-1' }, { id: 'c-2' }] },
    });
    prismaMock.workFormEntry.findMany.mockResolvedValue([]);
    prismaMock.workFormEntry.create
      .mockResolvedValueOnce({ id: 'e-1' })
      .mockResolvedValueOnce({ id: 'e-2' });

    const result = await workFormService.generateForm('wo-1', 'u-1');
    expect(result).toHaveLength(2);
    expect(auditServiceMock.log).toHaveBeenCalledTimes(1);
  });

  it('updates entry and sets completion metadata', async () => {
    prismaMock.workFormEntry.findUnique.mockResolvedValue({ id: 'e-1', completedAt: null });
    prismaMock.workFormEntry.update.mockResolvedValue({ id: 'e-1', status: 'COMPLETED' });

    const result = await workFormService.updateEntry('e-1', { status: 'COMPLETED' }, 'u-1');
    expect(result).toEqual({ id: 'e-1', status: 'COMPLETED' });
    expect(prismaMock.workFormEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedBy: 'u-1',
        }),
      })
    );
  });

  it('throws when updating a missing entry', async () => {
    prismaMock.workFormEntry.findUnique.mockResolvedValue(null);
    await expect(workFormService.updateEntry('missing', {}, 'u-1')).rejects.toBeInstanceOf(AppError);
  });

  it('returns JSON data snapshot for report generation', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      referenceNumber: 'WO-1',
      title: 'Title',
      type: 'BIOFOULING',
      status: 'IN_PROGRESS',
      location: null,
      scheduledStart: null,
      scheduledEnd: null,
      actualStart: null,
      actualEnd: null,
      completedAt: null,
      vessel: { name: 'V', vesselType: 'TUG', imoNumber: null, homePort: null },
      organisation: { name: 'Org' },
      assignments: [{ role: 'LEAD', user: { firstName: 'A', lastName: 'B', email: 'a@b.com' } }],
    });
    prismaMock.workFormEntry.findMany.mockResolvedValue([
      {
        vesselComponent: { name: 'Hull', category: 'HULL', location: 'Port' },
        condition: null,
        foulingRating: null,
        foulingType: null,
        coverage: null,
        coatingCondition: null,
        corrosionType: null,
        corrosionSeverity: null,
        notes: null,
        recommendation: null,
        actionRequired: false,
        status: 'PENDING',
        attachments: '[]',
      },
    ]);

    const json = await workFormService.getFormDataJson('wo-1');
    expect(json.workOrder.referenceNumber).toBe('WO-1');
    expect(json.entries).toHaveLength(1);
  });

  it('throws when building JSON for missing work order', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue(null);
    await expect(workFormService.getFormDataJson('missing')).rejects.toBeInstanceOf(AppError);
  });

  it('adds attachment to existing form entry', async () => {
    prismaMock.workFormEntry.findUnique.mockResolvedValue({ id: 'e-1', attachments: '["a"]' });
    prismaMock.workFormEntry.update.mockResolvedValue({ id: 'e-1', attachments: '["a","b"]' });

    const result = await workFormService.addAttachment('e-1', 'b');
    expect(result).toEqual({ id: 'e-1', attachments: '["a","b"]' });
  });

  it('adds attachment when attachments are initially empty', async () => {
    prismaMock.workFormEntry.findUnique.mockResolvedValue({ id: 'e-2', attachments: '' });
    prismaMock.workFormEntry.update.mockResolvedValue({ id: 'e-2', attachments: '["x"]' });

    const result = await workFormService.addAttachment('e-2', 'x');
    expect(result).toEqual({ id: 'e-2', attachments: '["x"]' });
  });

  it('throws when adding attachment to missing entry', async () => {
    prismaMock.workFormEntry.findUnique.mockResolvedValue(null);
    await expect(workFormService.addAttachment('missing', 'x')).rejects.toBeInstanceOf(AppError);
  });
});
