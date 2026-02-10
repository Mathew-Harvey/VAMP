import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { PaginationParams, buildPaginatedResponse } from '../utils/pagination';
import { auditService } from './audit.service';
import { Prisma } from '@prisma/client';

export const vesselService = {
  async list(params: PaginationParams, organisationId: string, filters?: Record<string, string>) {
    const where: Prisma.VesselWhereInput = { isDeleted: false, organisationId };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { imoNumber: { contains: params.search } },
        { callSign: { contains: params.search } },
      ];
    }
    if (filters?.status) where.status = filters.status as any;
    if (filters?.vesselType) where.vesselType = filters.vesselType as any;
    if (filters?.complianceStatus) where.complianceStatus = filters.complianceStatus as any;

    const [data, total] = await Promise.all([
      prisma.vessel.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: { organisation: { select: { id: true, name: true } } },
      }),
      prisma.vessel.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, params);
  },

  async getById(id: string) {
    const vessel = await prisma.vessel.findFirst({
      where: { id, isDeleted: false },
      include: {
        organisation: { select: { id: true, name: true } },
        nicheAreas: true,
        components: { orderBy: { sortOrder: 'asc' } },
        inspections: { orderBy: { createdAt: 'desc' }, take: 5 },
        workOrders: { orderBy: { createdAt: 'desc' }, take: 5, where: { isDeleted: false } },
      },
    });
    if (!vessel) throw new AppError(404, 'NOT_FOUND', 'Vessel not found');
    return vessel;
  },

  async create(data: any, organisationId: string, userId: string) {
    const payload = { ...data, organisationId } as any;
    if (Array.isArray(payload.climateZones)) payload.climateZones = JSON.stringify(payload.climateZones);
    const vessel = await prisma.vessel.create({
      data: payload,
    });

    await auditService.log({
      actorId: userId,
      entityType: 'Vessel',
      entityId: vessel.id,
      action: 'CREATE',
      description: `Created vessel "${vessel.name}"`,
      newData: vessel as any,
    });

    return vessel;
  },

  async update(id: string, data: any, userId: string) {
    const existing = await prisma.vessel.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Vessel not found');

    const vessel = await prisma.vessel.update({ where: { id }, data });

    await auditService.log({
      actorId: userId,
      entityType: 'Vessel',
      entityId: vessel.id,
      action: 'UPDATE',
      description: `Updated vessel "${vessel.name}"`,
      previousData: existing as any,
      newData: vessel as any,
      changedFields: Object.keys(data),
    });

    return vessel;
  },

  async softDelete(id: string, userId: string) {
    const existing = await prisma.vessel.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Vessel not found');

    await prisma.vessel.update({ where: { id }, data: { isDeleted: true } });

    await auditService.log({
      actorId: userId,
      entityType: 'Vessel',
      entityId: id,
      action: 'DELETE',
      description: `Soft-deleted vessel "${existing.name}"`,
    });
  },
};
