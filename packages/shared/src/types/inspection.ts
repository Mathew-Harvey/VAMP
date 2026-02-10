export interface Inspection {
  id: string;
  workOrderId: string;
  vesselId: string;
  type: string;
  status: string;
  inspectorName: string;
  inspectorOrg?: string | null;
  inspectorCert?: string | null;
  waterTemp?: number | null;
  waterVisibility?: number | null;
  waterSalinity?: number | null;
  weatherConditions?: string | null;
  seaState?: string | null;
  tideState?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  overallRating?: number | null;
  summary?: string | null;
  recommendations?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionFinding {
  id: string;
  inspectionId: string;
  nicheAreaId?: string | null;
  area: string;
  foulingRating?: number | null;
  foulingType?: string | null;
  coverage?: number | null;
  condition?: string | null;
  measurementType?: string | null;
  measurementValue?: number | null;
  measurementUnit?: string | null;
  referenceStandard?: string | null;
  coatingCondition?: string | null;
  corrosionType?: string | null;
  corrosionSeverity?: string | null;
  description?: string | null;
  recommendation?: string | null;
  actionRequired: boolean;
  priority: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}
