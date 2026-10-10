import { riseParticleMaterial as platformRiseParticleMaterial, type RiseParticleGlsl as PlatformRiseParticleGlsl, type RiseParticleRow as PlatformRiseParticleRow, type RiseParticleShared as PlatformRiseParticleShared } from '@wildshard/game/systems/looks/riseParticles';

/** One rising particle kind: life, rise, spread, size from birth to death, wind and blend (SHARD-PLATFORM M3, the looks system). */
export type RiseParticleRow = PlatformRiseParticleRow;
/** The particles' program stages. */
export type RiseParticleGlsl = PlatformRiseParticleGlsl;
/** What every kind's material shares: the noise texture and the live uniforms. */
export type RiseParticleShared = PlatformRiseParticleShared;
/** A kind's material: one program for every kind (the kind a uniform branch), driven entirely by uTime. */
export const riseParticleMaterial: typeof platformRiseParticleMaterial = platformRiseParticleMaterial;
