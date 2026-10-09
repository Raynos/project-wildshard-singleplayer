import type * as TrampleModule from '@wildshard/game/systems/looks/trample';
import type * as GrassField from '@wildshard/game/systems/looks/grassField';
import type * as ParticleModule from '@wildshard/game/systems/looks/particles';
/** Defer rendered particles until the authored world hook has its terrain and backdrop. */
export function loadParticles(): Promise<typeof ParticleModule> { return import('@wildshard/game/systems/looks/particles'); }

/** Meadow placement and trampling are runtime services. */
export async function loadGrassField(): Promise<typeof TrampleModule & Pick<typeof GrassField, 'grassBaseHeightAt' | 'configureGrassField'>> { const a = await import('@wildshard/game/systems/looks/trample'); const b = await import('@wildshard/game/systems/looks/grassField'); return { ...a, grassBaseHeightAt: b.grassBaseHeightAt, configureGrassField: b.configureGrassField }; }
