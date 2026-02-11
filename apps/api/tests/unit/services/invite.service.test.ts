import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notificationServiceMock, emailServiceMock, auditServiceMock } = vi.hoisted(() => ({
  prismaMock: {
    workOrder: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    workOrderAssignment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    invitation: { create: vi.fn() },
  },
  notificationServiceMock: { create: vi.fn() },
  emailServiceMock: { sendWorkOrderInvite: vi.fn().mockResolvedValue({ sent: true }) },
  auditServiceMock: { log: vi.fn() },
}));

vi.mock('../../../src/config/database', () => ({ default: prismaMock }));
vi.mock('../../../src/services/notification.service', () => ({ notificationService: notificationServiceMock }));
vi.mock('../../../src/services/email.service', () => ({ emailService: emailServiceMock }));
vi.mock('../../../src/services/audit.service', () => ({ auditService: auditServiceMock }));

import { inviteService } from '../../../src/services/invite.service';
import { AppError } from '../../../src/middleware/error';

describe('inviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      referenceNumber: 'WO-1',
      title: 'Work order',
      organisationId: 'org-1',
      vessel: { name: 'Vessel' },
      organisation: { name: 'Owner org' },
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'inviter', firstName: 'Inv', lastName: 'Iter' });
  });

  it('throws when work order does not exist', async () => {
    prismaMock.workOrder.findFirst.mockResolvedValue(null);
    await expect(inviteService.inviteToWorkOrder('wo', 'a@b.com', 'READ', 'u-1')).rejects.toBeInstanceOf(AppError);
  });

  it('updates existing assignment role', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'inviter', firstName: 'Inv', lastName: 'Iter' })
      .mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com', firstName: 'A', lastName: 'B' });
    prismaMock.workOrderAssignment.findFirst.mockResolvedValue({ id: 'as-1', role: 'OBSERVER' });

    const result = await inviteService.inviteToWorkOrder('wo-1', 'a@b.com', 'WRITE', 'inviter');
    expect(result.status).toBe('updated');
    expect(prismaMock.workOrderAssignment.update).toHaveBeenCalled();
  });

  it('returns updated when assignment already matches role', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'inviter', firstName: 'Inv', lastName: 'Iter' })
      .mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com', firstName: 'A', lastName: 'B' });
    prismaMock.workOrderAssignment.findFirst.mockResolvedValue({ id: 'as-1', role: 'TEAM_MEMBER' });

    const result = await inviteService.inviteToWorkOrder('wo-1', 'a@b.com', 'WRITE', 'inviter');
    expect(result.status).toBe('updated');
    expect(prismaMock.workOrderAssignment.update).not.toHaveBeenCalled();
  });

  it('assigns existing user and sends notifications', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'inviter', firstName: 'Inv', lastName: 'Iter' })
      .mockResolvedValueOnce({ id: 'user-2', email: 'c@d.com', firstName: 'C', lastName: 'D' });
    prismaMock.workOrderAssignment.findFirst.mockResolvedValue(null);

    const result = await inviteService.inviteToWorkOrder('wo-1', 'c@d.com', 'READ', 'inviter');
    expect(result.status).toBe('assigned');
    expect(prismaMock.workOrderAssignment.create).toHaveBeenCalled();
    expect(notificationServiceMock.create).toHaveBeenCalled();
    expect(auditServiceMock.log).toHaveBeenCalled();
  });

  it('creates invitation for new user', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'inviter', firstName: 'Inv', lastName: 'Iter' })
      .mockResolvedValueOnce(null);

    const result = await inviteService.inviteToWorkOrder('wo-1', 'new@user.com', 'ADMIN', 'inviter');
    expect(result.status).toBe('invited');
    expect(prismaMock.invitation.create).toHaveBeenCalled();
  });

  it('uses fallback inviter name and WRITE role mapping for new user invitations', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await inviteService.inviteToWorkOrder('wo-1', 'new-write@user.com', 'WRITE', 'missing-inviter');
    expect(result.status).toBe('invited');
    expect(prismaMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'OPERATOR',
        }),
      })
    );
    expect(emailServiceMock.sendWorkOrderInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        inviterName: 'A team member',
      })
    );
  });

  it('changes permission for assigned collaborator', async () => {
    prismaMock.workOrderAssignment.findFirst.mockResolvedValue({ id: 'as-1', role: 'TEAM_MEMBER' });
    const result = await inviteService.changePermission('wo-1', 'user-1', 'READ', 'admin-1');
    expect(result.role).toBe('OBSERVER');
    expect(prismaMock.workOrderAssignment.update).toHaveBeenCalled();
  });

  it('throws when changing permission for missing assignment', async () => {
    prismaMock.workOrderAssignment.findFirst.mockResolvedValue(null);
    await expect(inviteService.changePermission('wo-1', 'user-1', 'READ', 'admin-1')).rejects.toBeInstanceOf(AppError);
  });

  it('removes collaborator from work order', async () => {
    await inviteService.removeFromWorkOrder('wo-1', 'user-1', 'admin-1');
    expect(prismaMock.workOrderAssignment.deleteMany).toHaveBeenCalled();
    expect(auditServiceMock.log).toHaveBeenCalled();
  });
});
