import type { Mount } from '@wildshard/sdk/modes';

/** Shipping mounted control profile; camp registration and earned taming still own the available horses. */
export const NALATI_RIDE: ReturnType<Mount['toModeData']> = { id: 'ride', gaits: { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 } };
/** Native mounted phase owns this law in both page and headless runtime. */
export const NALATI_MODES = { traverse: [], ride: [NALATI_RIDE] };
