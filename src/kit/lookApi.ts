import type * as TrampleModule from './looks/trample';
import type * as GrassField from './looks/grassField';
import type * as ParticleModule from './looks/particles';
/** Defer rendered particles until the authored world hook has its terrain and backdrop. */
export function loadParticles(): Promise<typeof ParticleModule> { return import('./looks/particles'); }

/** Meadow placement and trampling are runtime services. */
export async function loadGrassField(): Promise<typeof TrampleModule & Pick<typeof GrassField, 'grassBaseHeightAt'>> { const a = await import('./looks/trample'); const b = await import('./looks/grassField'); return { ...a, grassBaseHeightAt: b.grassBaseHeightAt }; }
