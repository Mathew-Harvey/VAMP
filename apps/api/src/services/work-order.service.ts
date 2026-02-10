import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { PaginationParams, buildPaginatedResponse } from '../utils/pagination';
import { generateWorkOrderReference } from '../utils/helpers';
import { auditService } from './audit.service';
import { Prisma } from '@prisma/client';

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_REVIEW', 'ON_HOLD', 'CANCELLED'],
  AWAITING_REVIEW: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['COMPLETED', 'IN_PROGRESS'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const workOrderService = {
  async list(params: PaginationParams, organisationId: string, filters?: Record<string, string>) {
    const where: Prisma.WorkOrderWhereInput = { isDeleted: false, organisationId };

    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { referenceNumber: { contains: params.search } },
      ];
    }
    if (filters?.status) where.status = filters.status as any;
    if (filters?.type) where.type = filters.type as any;
    if (filters?.vesselId) where.vesselId = filters.vesselId;
    if (filters?.priority) where.priority = filters.priority as any;

    const [data, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: {
          vessel: { select: { id: true, name: true } },
          assignments: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        },
      }),
      prisma.workOrder.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, params);
  },

  async getById(id: string) {
    const wo = await prisma.workOrder.findFirst({
      where: { id, isDeleted: false },
      include: {
        vessel: { select: { id: true, name: true, vesselType: true } },
        organisation: { select: { id: true, name: true } },
        assignments: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        inspections: { orderBy: { createdAt: 'desc' } },
        taskSubmissions: { include: { task: true, user: { select: { id: true, firstName: true, lastName: true } } } },
        comments: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } },
        workflow: { include: { steps: { include: { tasks: true }, orderBy: { order: 'asc' } } } },
      },
    });
    if (!wo) throw new AppError(404, 'NOT_FOUND', 'Work order not found');
    return wo;
  },

  async create(data: any, organisationId: string, userId: string) {
    const referenceNumber = await generateWorkOrderReference();
    const payload = { ...data, organisationId, referenceNumber } as any;
    if (Array.isArray(payload.complianceFramework)) payload.complianceFramework = JSON.stringify(payload.complianceFramework);
    const wo = await prisma.workOrder.create({
      data: payload,
    });

    await auditService.log({
      actorId: userId,
      entityType: 'WorkOrder',
      entityId: wo.id,
      action: 'CREATE',
      description: `Created work order ${wo.referenceNumber}: "${wo.title}"`,
      newData: wo as any,
    });

    return wo;
  },

  async update(id: string, data: any, userId: string) {
    const existing = await prisma.workOrder.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Work order not found');

    const wo = await prisma.workOrder.update({ where: { id }, data });

    await auditService.log({
      actorId: userId,
      entityType: 'WorkOrder',
      entityId: wo.id,
      action: 'UPDATE',
      description: `Updated work order ${wo.referenceNumber}`,
      previousData: existing as any,
      newData: wo as any,
      changedFields: Object.keys(data),
    });

    return wo;
  },

  async changeStatus(id: string, newStatus: string, userId: string, reason?: string) {
    const wo = await prisma.workOrder.findFirst({ where: { id, isDeleted: false } });
    if (!wo) throw new AppError(404, 'NOT_FOUND', 'Work order not found');

    const allowedTransitions = VALID_TRANSITIONS[wo.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new AppError(400, 'INVALID_TRANSITION', `Cannot transition from ${wo.status} to ${newStatus}`);
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'IN_PROGRESS' && !wo.actualStart) updateData.actualStart = new Date();
    if (newStatus === 'COMPLETED') { updateData.completedAt = new Date(); updateData.actualEnd = new Date(); }

    const updated = await prisma.workOrder.update({ where: { id }, data: updateData });

    await auditService.log({
      actorId: userId,
      entityType: 'WorkOrder',
      entityId: id,
      action: 'STATUS_CHANGE',
      description: `Changed status of ${wo.referenceNumber} from ${wo.status} to ${newStatus}${reason ? `: ${reason}` : ''}`,
      previousData: { status: wo.status } as any,
      newData: { status: newStatus } as any,
    });

    return updated;
  },

  async assign(workOrderId: string, userId: string, role: string, actorId: string) {
    const wo = await prisma.workOrder.findFirst({ where: { id: workOrderId, isDeleted: false } });
    if (!wo) throw new AppError(404, 'NOT_FOUND', 'Work order not found');

    const assignment = await prisma.workOrderAssignment.upsert({
      where: { workOrderId_userId: { workOrderId, userId } },
      update: { role: role as any },
      create: { workOrderId, userId, role: role as any },
    });

    await auditService.log({
      actorId: actorId,
      entityType: 'WorkOrder',
      entityId: workOrderId,
      action: 'ASSIGNMENT',
      description: `Assigned user ${userId} as ${role} to ${wo.referenceNumber}`,
    });

    return assignment;
  },

  async unassign(workOrderId: string, userId: string, actorId: string) {
    await prisma.workOrderAssignment.delete({
      where: { workOrderId_userId: { workOrderId, userId } },
    });

    await auditService.log({
      actorId: actorId,
      entityType: 'WorkOrder',
      entityId: workOrderId,
      action: 'ASSIGNMENT',
      description: `Unassigned user ${userId} from work order`,
    });
  },

  async softDelete(id: string, userId: string) {
    const existing = await prisma.workOrder.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Work order not found');

    await prisma.workOrder.update({ where: { id }, data: { isDeleted: true } });

    await auditService.log({
      actorId: userId,
      entityType: 'WorkOrder',
      entityId: id,
      action: 'DELETE',
      description: `Soft-deleted work order ${existing.referenceNumber}`,
    });
  },
};
