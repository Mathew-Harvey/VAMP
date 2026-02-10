export interface Vessel {
  id: string;
  organisationId: string;
  name: string;
  imoNumber?: string | null;
  mmsi?: string | null;
  callSign?: string | null;
  flagState?: string | null;
  vesselType: string;
  grossTonnage?: number | null;
  lengthOverall?: number | null;
  beam?: number | null;
  maxDraft?: number | null;
  minDraft?: number | null;
  yearBuilt?: number | null;
  homePort?: string | null;
  classificationSociety?: string | null;
  afsCoatingType?: string | null;
  afsManufacturer?: string | null;
  afsProductName?: string | null;
  afsApplicationDate?: Date | null;
  afsServiceLife?: number | null;
  lastDrydockDate?: Date | null;
  nextDrydockDate?: Date | null;
  typicalSpeed?: number | null;
  tradingRoutes?: string | null;
  operatingArea?: string | null;
  climateZones: string[];
  status: string;
  complianceStatus: string;
  bfmpDocumentUrl?: string | null;
  bfmpRevision?: string | null;
  bfmpRevisionDate?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NicheArea {
  id: string;
  vesselId: string;
  name: string;
  location?: string | null;
  afsType?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
