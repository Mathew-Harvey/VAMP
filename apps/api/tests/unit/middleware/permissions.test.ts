import { describe, it, expect, vi } from 'vitest';
import { requirePermission, requireRole } from '../../../src/middleware/permissions';

describe('Permission Middleware', () => {
  function createMockReqRes(user?: any) {
    const req = { user } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    return { req, res, next };
  }

  describe('requirePermission', () => {
    it('should deny unauthenticated users', () => {
      const { req, res, next } = createMockReqRes(undefined);
      requirePermission('VESSEL_VIEW')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should allow users with exact permission', () => {
      const { req, res, next } = createMockReqRes({ permissions: ['VESSEL_VIEW'] });
      requirePermission('VESSEL_VIEW')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow ADMIN_FULL_ACCESS to access anything', () => {
      const { req, res, next } = createMockReqRes({ permissions: ['ADMIN_FULL_ACCESS'] });
      requirePermission('VESSEL_DELETE')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny users without required permission', () => {
      const { req, res, next } = createMockReqRes({ permissions: ['VESSEL_VIEW'] });
      requirePermission('VESSEL_DELETE')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should accept any of multiple permissions', () => {
      const { req, res, next } = createMockReqRes({ permissions: ['VESSEL_EDIT'] });
      requirePermission('VESSEL_VIEW', 'VESSEL_EDIT')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow matching roles', () => {
      const { req, res, next } = createMockReqRes({ role: 'MANAGER' });
      requireRole('MANAGER', 'ECOSYSTEM_ADMIN')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny non-matching roles', () => {
      const { req, res, next } = createMockReqRes({ role: 'VIEWER' });
      requireRole('MANAGER')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
