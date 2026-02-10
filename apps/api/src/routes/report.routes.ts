import { Router, Request, Response } from 'express';
import { reportService } from '../services/report.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.post('/generate', authenticate, requirePermission('REPORT_GENERATE'), async (req: Request, res: Response) => {
  try {
    const { type, inspectionId, workOrderId } = req.body;
    let data;
    if (type === 'inspection' && inspectionId) {
      data = await reportService.generateInspectionReport(inspectionId);
    } else if (type === 'work-order' && workOrderId) {
      data = await reportService.generateWorkOrderReport(workOrderId);
    } else {
      res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Invalid report type' } });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.get('/documents', authenticate, requirePermission('REPORT_VIEW'), async (req: Request, res: Response) => {
  try {
    const data = await reportService.getDocuments({ vesselId: req.query.vesselId as string, workOrderId: req.query.workOrderId as string });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: error.message } });
  }
});

export default router;
