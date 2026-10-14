import { SIGNAL_LEVEL } from './headlessLevel';

/** The native host owns the admitted collider lattice and original baked pieces, with no motion role. */
export const SIGNAL_NATIVE_WORLD = { terrain: 'collider', ground: SIGNAL_LEVEL.ground, player: SIGNAL_LEVEL.player } as const;
