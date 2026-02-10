import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';

export function generateTestToken(payload: {
  userId: string;
  email: string;
  organisationId: string;
  role: string;
  permissions: string[];
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function generateExpiredToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' });
}

export const testAdminPayload = {
  userId: 'test-admin-id',
  email: 'admin@test.com',
  organisationId: 'test-org-id',
  role: 'ECOSYSTEM_ADMIN',
  permissions: ['ADMIN_FULL_ACCESS'],
};

export const testOperatorPayload = {
  userId: 'test-operator-id',
  email: 'operator@test.com',
  organisationId: 'test-org-id',
  role: 'OPERATOR',
  permissions: ['VESSEL_VIEW', 'WORK_ORDER_VIEW', 'INSPECTION_CREATE', 'INSPECTION_EDIT', 'INSPECTION_VIEW', 'REPORT_VIEW'],
};

export const testViewerPayload = {
  userId: 'test-viewer-id',
  email: 'viewer@test.com',
  organisationId: 'test-org-id',
  role: 'VIEWER',
  permissions: ['VESSEL_VIEW', 'WORK_ORDER_VIEW', 'INSPECTION_VIEW', 'REPORT_VIEW'],
};
