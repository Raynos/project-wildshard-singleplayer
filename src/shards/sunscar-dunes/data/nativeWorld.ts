import { SIGNAL_NATIVE_POPULATION } from './population';
import { SIGNAL_HEADLESS, SIGNAL_BOSS_OWNER } from './headlessOwners';
import { SIGNAL_LEVEL } from './headlessLevel';

/** The native host owns the admitted collider lattice and original baked pieces, with no motion role. */
export const SIGNAL_NATIVE_WORLD = { runtime: { weapon: { id: SIGNAL_HEADLESS.lash.id, questWorld: true }, quest: { spots: 'metadata', crack: true, summons: [{ director: 'sunscar.signal-fire', spawn: 'sunscar.matriarch' }] }, entries: SIGNAL_HEADLESS.entries }, population: { rows: SIGNAL_NATIVE_POPULATION, sources: 'actors+bosses', seed: 'declared', owner: SIGNAL_BOSS_OWNER }, terrain: 'collider', ground: SIGNAL_LEVEL.ground, player: SIGNAL_LEVEL.player } as const;
