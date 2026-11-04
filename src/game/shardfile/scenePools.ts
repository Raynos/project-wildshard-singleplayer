import { parseWorldScenes, type WorldScenesSection } from '@wildshard/format/worldScenes';
import { isJsonData } from '@wildshard/format/json';
import { TIER } from '@wildshard/engine/core/tier';
import { Matrix4 } from 'three';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { createModelLibrary, type ModelGeometryPool, type ModelLibrary, type RestPoolStore } from '../plugin/geometry';
import { readHomeBuildGeometry, saveHomeBuildGeometry } from './homeBuildCache';
import type { ShardProduct } from './shardProduct';

/** A world-scene pool library row (format/worldScenes `kind: 'pool'`). */
export type WorldScenePoolRow = Extract<WorldScenesSection['libraries'][number], { readonly kind: 'pool' }>;

/** A tier-selected file name. */
export const tierFile = (file: string | { readonly phone: string; readonly desktop: string }): string => typeof file === 'string' ? file : file[TIER];

/**
 * A world-scene pool library's decoder (createModelLibrary `geometryPools`: each file's parts and Float32 channel renames,
 * its painted models), reading its files through the product's verified reader. The resident world scenes decode a
 * pool whole; the scene catalogue's cold intake passes only the files holding its declared parts (`files`), each with
 * its full parts roster and channel rules.
 */
/** DL6: a pool file's key in the home build cache and its cold seed: what its prepared parts are made of (the file's URL,
 *  the tier, the parts roster and the channel renames). */
export function scenePoolKey(pool: Pick<ModelGeometryPool, 'url' | 'parts' | 'channels'>): string {
  return `pool:${JSON.stringify([pool.url, TIER, pool.parts, pool.channels ?? null])}`;
}

/** DL6: the home build cache as a pool library's rest store. Only the bound Home reads or writes (homeBuildCache); a
 *  restored pool is one identity-matrix view per part, as the save writes it. */
export function homeRestPools(source: Shardfile): RestPoolStore {
  return {
    read: async pool => {
      const views = await readHomeBuildGeometry(source, scenePoolKey(pool)); if (views === null) return null;
      if ([...views.values()].every(view => view.matrix.equals(new Matrix4()))) return new Map([...views].map(([name, view]) => [name, view.geometry]));
      for (const view of views.values()) view.geometry.dispose();
      return null;
    },
    save: (pool, parts) => { void saveHomeBuildGeometry(source, scenePoolKey(pool), new Map([...parts].map(([name, geometry]) => [name, { geometry, matrix: new Matrix4() }]))); },
  };
}

export function worldScenePool(product: Pick<ShardProduct, 'file' | 'url'>, row: WorldScenePoolRow, selected?: WorldScenePoolRow['files'], restPools?: RestPoolStore): ModelLibrary<never, never> {
  // Admit and detach all rows before URL lookup, decoder construction or verified reads.
  const admitted = parseWorldScenes({ version: 1, libraries: [row], materials: [], steps: [] }).libraries[0];
  if (admitted?.kind !== 'pool') throw new Error('Expected a scene pool');
  const full = selected === undefined || selected === row.files;
  if (!full && (!isJsonData(selected) || new Set(selected).size !== selected.length)) throw new Error('Scene pool requires distinct declared files');
  const files = full ? admitted.files : selected.map(file => {
    const index = row.files.indexOf(file), copy = admitted.files[index];
    if (copy === undefined) throw new Error('Scene pool requires declared files');
    return copy;
  });
  const painted = full ? admitted.painted : [];
  return createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    paintedModels: painted.map(model => ({ name: model.id, url: product.url(model.file), geometry: model.geometry })),
    geometryPools: files.map(file => ({ url: product.url(tierFile(file.file)), parts: file.parts, ...(file.channels === undefined ? {} : { channels: file.channels }) })),
    ...(restPools === undefined ? {} : { restPools }) }, 'world scene library', {},
    async url => {
      const file = [...files.map(entry => tierFile(entry.file)), ...painted.map(entry => entry.file)].find(name => product.url(name) === url);
      if (file === undefined) throw new Error('Missing scene library file');
      const { prepareRigLoader } = await import('@wildshard/engine/anim/rig');
      return (await prepareRigLoader()).createRigLoader().parseBytesAsync(await product.file(file), '');
    });
}
