import { RANGER, MILLER, TRADER } from '../quest/wardensHollow';

/** Existing speaker order and legacy native save envelopes; text and payouts keep their owners. */
export const PINE_READINGS = {
  speakers: { ranger: RANGER, miller: MILLER, trader: TRADER },
  continuation: { bare: 'ranger', wrapped: ['miller', 'trader'] },
} as const;
