import { nalatiDressingPlacementProgram } from './dressingPlacementProgram.ts';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';

/** Node authors supply the physical read; this pure binding names only the defining producer's terrain/scalars.
 * @param {(name: string) => Uint8Array} read */
export function nativeNalatiDressingPlacements(read) {
  return nalatiDressingPlacementProgram({ cached: (step, make) => {
    const inputs = new Map();
    for (const name of step.inputs ?? []) {
      if (name === terrain) inputs.set(name, read(`public${name}`));
      else if (/^data\/geography-(?:pond|red|green|blue|forest)\.bin$/u.test(name)) inputs.set(name, read(`src/shards/nalati-grasslands/${name}`));
      else throw new Error('Unknown native dressing input');
    }
    return Promise.resolve(make(inputs));
  } });
}
