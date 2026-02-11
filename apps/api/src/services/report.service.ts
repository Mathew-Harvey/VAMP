import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { workFormService } from './work-form.service';

// Register Handlebars helpers
Handlebars.registerHelper('toLowerCase', (str: string) => str?.toLowerCase() || '');
Handlebars.registerHelper('ifEquals', function (this: any, a: any, b: any, options: any) {
  return a === b ? options.fn(this) : options.inverse(this);
});

const PHOTOS_PER_PAGE = 16; // 2 columns x 8 rows

export const reportService = {
  async generateInspectionReport(workOrderId: string) {
    // Get full form data
    const formData = await workFormService.getFormDataJson(workOrderId);

    // Organize photos into pages (2 columns x 8 rows = 16 per page)
    const photoPages: Array<{ sectionName: string; photos: Array<{ src: string; caption: string }> }> = [];

    for (const entry of formData.entries) {
      let attachments: string[] = [];
      try {
        attachments = typeof entry.attachments === 'string' ? JSON.parse(entry.attachments) : (entry.attachments || []);
      } catch { /* ignore */ }

      if (attachments.length === 0) continue;

      const photos = attachments.map((src: string, i: number) => ({
        src,
        caption: `${entry.component} - Photo ${i + 1}`,
      }));

      // Split into pages of PHOTOS_PER_PAGE
      for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) {
        photoPages.push({
          sectionName: entry.component,
          photos: photos.slice(i, i + PHOTOS_PER_PAGE),
        });
      }
    }

    // Load and compile template
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'inspection-report.html');
    let templateSource: string;
    try {
      templateSource = fs.readFileSync(templatePath, 'utf-8');
    } catch {
      // Fallback: return raw data if template not found
      return { ...formData, photoPages, html: null };
    }

    const template = Handlebars.compile(templateSource);
    const html = template({
      ...formData,
      photoPages,
    });

    return {
      ...formData,
      photoPages,
      html,
    };
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
        formEntries: { include: { vesselComponent: true } },
      },
    });
    if (!workOrder) throw new AppError(404, 'NOT_FOUND', 'Work order not found');
    return workOrder;
  },

  async getDocuments(filters: { vesselId?: string; workOrderId?: string } = {}, organisationId?: string) {
    const where: any = {};
    if (filters?.vesselId) where.vesselId = filters.vesselId;
    if (filters?.workOrderId) where.workOrderId = filters.workOrderId;
    if (organisationId) {
      where.OR = [
        { workOrder: { organisationId, isDeleted: false } },
        { vessel: { organisationId, isDeleted: false } },
      ];
    }

    return prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },
};
