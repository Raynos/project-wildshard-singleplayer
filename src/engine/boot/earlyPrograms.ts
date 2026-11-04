import type * as THREE from 'three';
import type { Game } from '../core/Game';
import { jsonSlot } from '../saves/slots';

/** DL10 (11-04): Debug ▸ Loading & memory ▸ Early shader compile. 'on' issues the programs of what the spawn view draws
 *  as soon as the world is built, so `KHR_parallel_shader_compile` links them on the driver's threads while the rest of
 *  loading (and its download) runs; the Shaders step then finds them linked. The Simulator's cold run spent 5.0 s there
 *  (Nine, 69fa647: 50 programs linked ≈ 3.5 s, all after the download). Default off: a compile under the download can
 *  contend with the phone's GPU process, so it ships behind this row until a Simulator / iPhone reading backs it (E451).
 *  A reload row: the first read of a page is its value. */
export const EARLY_PROGRAMS_SLOT = 'debug.earlyPrograms';
let frozen: boolean | undefined;
export function earlyProgramsOn(): boolean {
  frozen ??= jsonSlot(EARLY_PROGRAMS_SLOT, 'device').read() === 'on';
  return frozen;
}

let pending: Promise<void> | null = null;
/** Issue the scene's programs for what lies within `radius` of `at` (the spawn view), in sliced issue passes; links
 *  proceed in parallel. Post, shadow, offscreen and family jobs stay with the Shaders step (they need the final page). */
export function startEarlyPrograms(game: Game, at: THREE.Vector3, radius: number): void {
  const owner = game.levelScope;
  pending = (async () => {
    try {
      const { precompileLevel, arrivalPrograms } = await import('../render/precompile');
      await precompileLevel(game, undefined, { sceneOnly: true, chunkCasters: false, sliceMs: 12,
        arrival: arrivalPrograms(game.scene, at, radius), current: () => !owner.disposed && !owner.disposing });
    } catch (error) {
      // the Shaders step compiles whatever this pass did not reach
      if (!owner.disposed && !owner.disposing) console.info('[programs] early compile stopped', error);
    }
  })();
}
/** The Shaders step waits for an early pass first, so the two never issue the same programs at once. */
export function earlyPrograms(): Promise<void> { return pending ?? Promise.resolve(); }
