import { randomUUID } from 'crypto';

const PRE_HASHED_PASSWORD = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX.Y'; // Hash of 'testpassword'

export function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    passwordHash: PRE_HASHED_PASSWORD,
    isActive: true,
    ...overrides,
  };
}

export function buildOrganisation(overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    name: `Test Org ${Date.now()}`,
    type: 'SERVICE_PROVIDER' as const,
    ...overrides,
  };
}

export function buildVessel(overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    name: `Test Vessel ${Date.now()}`,
    vesselType: 'TUG' as const,
    status: 'ACTIVE' as const,
    complianceStatus: 'COMPLIANT' as const,
    climateZones: [],
    ...overrides,
  };
}

export function buildWorkOrder(overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    referenceNumber: `WO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
    title: `Test Work Order ${Date.now()}`,
    type: 'BIOFOULING_INSPECTION' as const,
    priority: 'NORMAL' as const,
    status: 'DRAFT' as const,
    complianceFramework: [],
    ...overrides,
  };
}
