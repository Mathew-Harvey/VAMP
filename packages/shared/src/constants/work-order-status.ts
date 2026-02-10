export const WORK_ORDER_STATUSES = {
  DRAFT: { label: 'Draft', color: '#94a3b8' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: '#f59e0b' },
  APPROVED: { label: 'Approved', color: '#22c55e' },
  IN_PROGRESS: { label: 'In Progress', color: '#0ea5e9' },
  AWAITING_REVIEW: { label: 'Awaiting Review', color: '#a855f7' },
  UNDER_REVIEW: { label: 'Under Review', color: '#8b5cf6' },
  COMPLETED: { label: 'Completed', color: '#22c55e' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444' },
  ON_HOLD: { label: 'On Hold', color: '#f97316' },
} as const;

export type WorkOrderStatus = keyof typeof WORK_ORDER_STATUSES;

export const WORK_ORDER_TYPES = {
  BIOFOULING_INSPECTION: 'Biofouling Inspection',
  HULL_CLEANING: 'Hull Cleaning',
  NICHE_AREA_CLEANING: 'Niche Area Cleaning',
  ENGINEERING_MAINTENANCE: 'Engineering Maintenance',
  STRUCTURAL_ASSESSMENT: 'Structural Assessment',
  CATHODIC_PROTECTION: 'Cathodic Protection',
  COATING_ASSESSMENT: 'Coating Assessment',
  NAVIGATION_AID_INSPECTION: 'Navigation Aid Inspection',
  NAVIGATION_AID_MAINTENANCE: 'Navigation Aid Maintenance',
  MOORING_INSPECTION: 'Mooring Inspection',
  FUNCTIONAL_TESTING: 'Functional Testing',
  EMERGENCY_REPAIR: 'Emergency Repair',
  GENERAL: 'General',
} as const;

export type WorkOrderType = keyof typeof WORK_ORDER_TYPES;

export const WORK_ORDER_PRIORITIES = {
  LOW: { label: 'Low', color: '#94a3b8' },
  NORMAL: { label: 'Normal', color: '#0ea5e9' },
  HIGH: { label: 'High', color: '#f59e0b' },
  URGENT: { label: 'Urgent', color: '#ef4444' },
} as const;

export type WorkOrderPriority = keyof typeof WORK_ORDER_PRIORITIES;
