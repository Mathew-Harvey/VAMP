import app from '../../src/app';
import prisma from '../../src/config/database';
import bcrypt from 'bcryptjs';
import { generateAccessToken } from '../../src/config/auth';

export { app, prisma };

export async function createTestOrg(name = 'Test Org') {
  return prisma.organisation.create({
    data: { name, type: 'SERVICE_PROVIDER' },
  });
}

export async function createTestUser(overrides: any = {}) {
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      ...overrides,
    },
  });
}

export async function createTestUserWithOrg() {
  const org = await createTestOrg();
  const user = await createTestUser();
  const orgUser = await prisma.organisationUser.create({
    data: {
      userId: user.id,
      organisationId: org.id,
      role: 'ECOSYSTEM_ADMIN',
      permissions: JSON.stringify(['ADMIN_FULL_ACCESS']),
      isDefault: true,
    },
  });
  const token = generateAccessToken({
    userId: user.id,
    email: user.email,
    organisationId: org.id,
    role: 'ECOSYSTEM_ADMIN',
    permissions: ['ADMIN_FULL_ACCESS'],
  });
  return { user, org, orgUser, token };
}

export async function createTestVessel(organisationId: string) {
  return prisma.vessel.create({
    data: {
      organisationId,
      name: `Test Vessel ${Date.now()}`,
      vesselType: 'TUG',
      status: 'ACTIVE',
      complianceStatus: 'COMPLIANT',
    },
  });
}

export async function createTestVesselWithComponents(organisationId: string) {
  const vessel = await createTestVessel(organisationId);
  const components = await Promise.all([
    prisma.vesselComponent.create({ data: { vesselId: vessel.id, name: 'Hull Bottom', category: 'HULL', sortOrder: 1 } }),
    prisma.vesselComponent.create({ data: { vesselId: vessel.id, name: 'Sea Chest Port', category: 'SEA_CHEST', sortOrder: 2 } }),
    prisma.vesselComponent.create({ data: { vesselId: vessel.id, name: 'Propeller', category: 'PROPELLER', sortOrder: 3 } }),
  ]);
  return { vessel, components };
}

export async function createTestWorkOrder(vesselId: string, organisationId: string, overrides: any = {}) {
  return prisma.workOrder.create({
    data: {
      referenceNumber: `WO-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      vesselId,
      organisationId,
      title: 'Test Work Order',
      type: 'BIOFOULING_INSPECTION',
      priority: 'NORMAL',
      status: 'DRAFT',
      ...overrides,
    },
  });
}

export async function cleanDatabase() {
  // Delete in order respecting FK constraints
  const tables = [
    'work_form_entries', 'video_rooms', 'task_submissions', 'workflow_tasks',
    'workflow_steps', 'workflows', 'inspection_findings', 'inspections',
    'media', 'documents', 'comments', 'work_order_assignments', 'work_orders',
    'vessel_components', 'niche_areas', 'vessels', 'notifications', 'audit_entries',
    'password_resets', 'invitations', 'organisation_users', 'users', 'organisations',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}
