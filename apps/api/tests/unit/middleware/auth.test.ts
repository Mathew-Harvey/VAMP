import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../../../src/middleware/auth';
import { generateTestToken, generateExpiredToken, testAdminPayload } from '../../helpers/auth';

describe('Auth Middleware', () => {
  function createMockReqRes(authHeader?: string) {
    const req = { headers: { authorization: authHeader } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    return { req, res, next };
  }

  it('should reject requests without auth header', () => {
    const { req, res, next } = createMockReqRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject requests with invalid auth format', () => {
    const { req, res, next } = createMockReqRes('InvalidFormat token123');
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept valid JWT token', () => {
    const token = generateTestToken(testAdminPayload);
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe(testAdminPayload.userId);
  });

  it('should reject expired tokens', () => {
    const token = generateExpiredToken(testAdminPayload);
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject malformed tokens', () => {
    const { req, res, next } = createMockReqRes('Bearer invalid.token.here');
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
