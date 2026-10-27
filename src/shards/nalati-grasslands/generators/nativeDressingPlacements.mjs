import { nalatiDressingPlacementProgram } from './dressingPlacementProgram.ts';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';

/** Node authors supply the physical read; this pure binding names only the defining producer's terrain/scalars.
 * @param {(name: string) => Uint8Array} read @param {ReadonlyMap<string, Uint8Array>} [geography] */
export function nativeNalatiDressingPlacements(read, geography) {
  return nalatiDressingPlacementProgram({ cached: (step, make) => {
    if (step.id === 'geography' && geography !== undefined) return Promise.resolve(geography);
    const inputs = new Map();
    for (const name of step.inputs ?? []) {
      if (name === terrain) inputs.set(name, read(`public${name}`));
      else throw new Error('Unknown native dressing input');
    }
    return Promise.resolve(make(inputs));
  } });
}
