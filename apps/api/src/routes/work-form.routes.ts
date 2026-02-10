import { Router, Request, Response } from 'express';
import { workFormService } from '../services/work-form.service';
import { vesselComponentService } from '../services/vessel-component.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// === Vessel Components (General Arrangement) ===

router.get('/vessels/:vesselId/components', authenticate, async (req: Request, res: Response) => {
  try {
    const components = await vesselComponentService.listByVessel(req.params.vesselId as string);
    res.json({ success: true, data: components });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.post('/vessels/:vesselId/components', authenticate, async (req: Request, res: Response) => {
  try {
    const component = await vesselComponentService.create(req.params.vesselId as string, req.body);
    res.status(201).json({ success: true, data: component });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.post('/vessels/:vesselId/components/bulk', authenticate, async (req: Request, res: Response) => {
  try {
    const components = await vesselComponentService.bulkCreate(req.params.vesselId as string, req.body.components);
    res.status(201).json({ success: true, data: components });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.put('/components/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const component = await vesselComponentService.update(req.params.id as string, req.body);
    res.json({ success: true, data: component });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.delete('/components/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await vesselComponentService.delete(req.params.id as string);
    res.json({ success: true, data: { message: 'Component deleted' } });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

// === Work Form Entries ===

router.post('/work-orders/:workOrderId/form/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const entries = await workFormService.generateForm(req.params.workOrderId as string, req.user!.userId);
    res.status(201).json({ success: true, data: entries });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.get('/work-orders/:workOrderId/form', authenticate, async (req: Request, res: Response) => {
  try {
    const entries = await workFormService.getFormEntries(req.params.workOrderId as string);
    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.put('/form-entries/:entryId', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await workFormService.updateEntry(req.params.entryId as string, req.body, req.user!.userId);
    res.json({ success: true, data: entry });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.post('/form-entries/:entryId/attachments', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await workFormService.addAttachment(req.params.entryId as string, req.body.mediaId);
    res.json({ success: true, data: entry });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

router.get('/work-orders/:workOrderId/form/json', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await workFormService.getFormDataJson(req.params.workOrderId as string);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
  }
});

// Pass through unmatched requests (e.g. /vessels/:id) to other route handlers
router.use((_req, _res, next) => next());

export default router;
