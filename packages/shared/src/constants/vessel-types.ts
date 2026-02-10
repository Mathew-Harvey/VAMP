export const VESSEL_TYPES = {
  CARGO_SHIP: 'Cargo Ship',
  TANKER: 'Tanker',
  BULK_CARRIER: 'Bulk Carrier',
  CONTAINER_SHIP: 'Container Ship',
  PASSENGER_VESSEL: 'Passenger Vessel',
  FISHING_VESSEL: 'Fishing Vessel',
  TUG: 'Tug',
  OFFSHORE_VESSEL: 'Offshore Vessel',
  NAVAL_FRIGATE: 'Naval Frigate',
  NAVAL_DESTROYER: 'Naval Destroyer',
  NAVAL_SUBMARINE: 'Naval Submarine',
  NAVAL_PATROL: 'Naval Patrol',
  NAVAL_LANDING_SHIP: 'Naval Landing Ship',
  NAVAL_AUXILIARY: 'Naval Auxiliary',
  RESEARCH_VESSEL: 'Research Vessel',
  NAVIGATION_AID: 'Navigation Aid',
  OTHER: 'Other',
} as const;

export type VesselType = keyof typeof VESSEL_TYPES;
