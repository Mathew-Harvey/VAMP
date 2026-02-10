export interface WorkOrder {
  id: string;
  referenceNumber: string;
  vesselId: string;
  organisationId: string;
  workflowId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  currentStepId?: string | null;
  currentTaskId?: string | null;
  regulatoryRef?: string | null;
  complianceFramework: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface WorkOrderAssignment {
  id: string;
  workOrderId: string;
  userId: string;
  role: string;
  assignedAt: Date;
}
