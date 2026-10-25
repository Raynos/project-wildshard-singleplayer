import { MeshStandardMaterial } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { HD_URLS, MODEL_URLS, SKY_HD } from './fileInventory';
import { facetedGeometry, hdGeometry } from './modelIntake';
import { bakeKeeperFigure } from './keeperFigure';
import { bakeVaneParts } from './vane';
import { PREPARED_MODEL_INPUTS, preparedModelSource } from './preparedModelProgram';

/** The retained writer consumes the same owned source program as future product readers. */
export function bakePreparedModels(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  return preparedModelSource(new Map(PREPARED_MODEL_INPUTS.map(url => [url, read(url)])));
}

async function bakeVanePart(read: (url: string) => Uint8Array, part: 0 | 1): Promise<Uint8Array> {
  const source = facetedGeometry((await readSourceModel(read(MODEL_URLS['wind-vane']))).gltf.scene, 0.6);
  if (source === null) throw new Error('Missing vane source');
  return staticGlb([{ name: 'vane', geometry: bakeVaneParts(source)[part], compactIndex: true, nativeAttributes: true, material: new MeshStandardMaterial() }], 'vane');
}
/** The authored vane post; flat channels stay exact through the standard facet library. */
export const bakeVanePost = (read: (url: string) => Uint8Array): Promise<Uint8Array> => bakeVanePart(read, 0);
/** The authored vane rotor in its local 2.2 metre pivot frame. */
export const bakeVaneRotor = (read: (url: string) => Uint8Array): Promise<Uint8Array> => bakeVanePart(read, 1);

/** Prepared geometry and original atlas rows; the author explicitly names nonempty NPC parts. */
export async function bakePreparedLibrary(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  const source = await readSourceModel(read(HD_URLS['keeper-hd']));
  const keeper = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
  if (keeper === null) throw new Error('Missing keeper author geometry');
  const pivots = bakeKeeperFigure(keeper.geometry).map((geometry, index) => geometry.getAttribute('position').count === 0 ? null : `hero-keeper-pivot-${String(index)}`);
  const rows = { pool: { url: '/assets/far-reach/baked/prepared-models.glb', parts: [...SKY_HD.map(name => `hero-${name}`), ...pivots.filter((part): part is string => part !== null)] },
    models: SKY_HD.map(name => name === 'keeper-hd' ? { name, url: HD_URLS[name], geometry: `hero-${name}`, releaseImage: true, pivots }
      : { name, url: HD_URLS[name], geometry: `hero-${name}`, releaseImage: true }) };
  return new TextEncoder().encode(`${JSON.stringify(rows)}\n`);
}
