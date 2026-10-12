import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';
import type { TerrainField } from '../level/data';

/** Required native WSTR bytes for a manifest ground; the selected level supplies the same seed. */
export interface BakedTerrainSource { readonly url: string; readonly seed: number }
/** Authored metadata and native water/trail laws, independent of the height lattice. */
export type BakedTerrainMetadata = Omit<TerrainField, 'heightAt' | 'normalAt' | 'splatAt'>;
interface Declaration { readonly source: BakedTerrainSource; install: (grid: BakedGrid) => void }
const declarations = new WeakMap<TerrainField, Declaration>();

/**
 * Declare a baked manifest ground without evaluating an analytic landscape.
 * Height/normal/splat reads refuse until the owning boot installs the required
 * bytes. Trail, water and datum metadata remain the caller's existing laws.
 * Construction neither fetches nor selects a level or installs a service.
 */
export function createBakedTerrainField(source: BakedTerrainSource, metadata: BakedTerrainMetadata): TerrainField {
  if (!/^\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(source.url) || source.url.split('/').includes('..')
    || !Number.isSafeInteger(source.seed) || source.seed < 0 || source.seed > 0xffffffff
    || !Number.isFinite(metadata.datum ?? 0)) throw new Error('Invalid baked terrain declaration');
  let samples: ReturnType<typeof bakedSamplers> | null = null;
  const declared = Object.freeze({ ...source });
  const missing = new Error(`Required baked terrain is not ready: ${source.url}`);
  const read = (): ReturnType<typeof bakedSamplers> => { if (samples === null) throw missing; return samples; };
  const datum = metadata.datum ?? 0;
  const field: TerrainField = { ...metadata,
    heightAt: (x, z) => read().heightAt(x, z) + datum,
    normalAt: (x, z, eps) => read().normalAt(x, z, eps),
    splatAt: (x, z) => read().splatAt(x, z),
  };
  declarations.set(field, { source: declared, install: grid => {
    if (grid.seed !== declared.seed || !Number.isInteger(grid.res) || grid.res < 2 || grid.res > 2049
      || !Number.isFinite(grid.size) || grid.size <= 0 || grid.heights.length !== grid.res ** 2
      || grid.splat.length !== grid.res ** 2 * 4 || grid.heights.some(height => !Number.isFinite(height))) throw new Error('Invalid declared baked terrain bytes');
    samples = bakedSamplers(grid);
  } });
  return field;
}

/** Required source of this field, or null for the existing analytic terrain path. */
export function bakedTerrainSource(field: TerrainField): BakedTerrainSource | null { return declarations.get(field)?.source ?? null; }
/** Install verified native samples only into the explicitly declared field; no level selection occurs. */
export function installDeclaredBakedTerrain(field: TerrainField, grid: BakedGrid): void { declarations.get(field)?.install(grid); }
