import prisma from '../config/database';
import { AppError } from '../middleware/error';

export const reportService = {
  async generateInspectionReport(inspectionId: string) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        vessel: true,
        workOrder: true,
        findings: { include: { media: true, nicheArea: true } },
        media: true,
      },
    });
    if (!inspection) throw new AppError(404, 'NOT_FOUND', 'Inspection not found');
    return inspection;
  },

  async generateWorkOrderReport(workOrderId: string) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, isDeleted: false },
      include: {
        vessel: true,
        organisation: true,
        assignments: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        inspections: { include: { findings: true } },
        taskSubmissions: { include: { task: true, user: { select: { firstName: true, lastName: true } } } },
        comments: { include: { author: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!workOrder) throw new AppError(404, 'NOT_FOUND', 'Work order not found');
    return workOrder;
  },

  async getDocuments(filters?: { vesselId?: string; workOrderId?: string }) {
    const where: any = {};
    if (filters?.vesselId) where.vesselId = filters.vesselId;
    if (filters?.workOrderId) where.workOrderId = filters.workOrderId;

    return prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },
};
