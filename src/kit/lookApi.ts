import type * as ParticleModule from './looks/particles';
/** Defer rendered particles until the authored world hook has its terrain and backdrop. */
export function loadParticles(): Promise<typeof ParticleModule> { return import('./looks/particles'); }
