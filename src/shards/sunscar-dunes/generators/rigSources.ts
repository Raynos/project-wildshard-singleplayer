import { bakeSignalSkitterer } from './species';
import { bakeSignalManta, bakeSignalStrider } from './hulls';
import { facetModel } from './facets';
import { MANTA_HULL, RAY_TINT, STRIDER_HULL } from './rows/hulls';
import FACET_AO_FLOOR from '../data/facets.json' with { type: 'json' };

/** Bake the original creature library from owned author inputs, without file I/O. */
export async function bakeSignalRigSources(striderBytes: Uint8Array, mantaBytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  files.set('skitterer.glb', bakeSignalSkitterer().glb);
  const strider = bakeSignalStrider(await facetModel(striderBytes, FACET_AO_FLOOR), STRIDER_HULL);
  files.set('strider.glb', strider.glb);
  files.set('striderRig.json', new TextEncoder().encode(strider.rig));
  const manta = await facetModel(mantaBytes, FACET_AO_FLOOR);
  files.set('ray.glb', bakeSignalManta('sunscar.ray', manta.clone(), MANTA_HULL, RAY_TINT).glb);
  files.set('matriarch.glb', bakeSignalManta('sunscar.matriarch', manta.clone(), MANTA_HULL, null).glb);
  return files;
}
