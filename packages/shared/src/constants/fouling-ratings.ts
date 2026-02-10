export const FOULING_RATINGS = {
  0: { label: 'No Fouling', color: '#22c55e', description: 'Clean, no visible fouling' },
  1: { label: 'Light Slime', color: '#86efac', description: 'Light slime layer only' },
  2: { label: 'Heavy Slime', color: '#fbbf24', description: 'Heavy slime, possible biofilm' },
  3: { label: 'Light Macrofouling', color: '#f97316', description: 'Light calcareous/non-calcareous growth' },
  4: { label: 'Heavy Macrofouling', color: '#ef4444', description: 'Heavy macrofouling, significant coverage' },
  5: { label: 'Severe Macrofouling', color: '#991b1b', description: 'Severe, extensive macrofouling' },
} as const;

export type FoulingRating = keyof typeof FOULING_RATINGS;
