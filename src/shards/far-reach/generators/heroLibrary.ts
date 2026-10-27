import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { HD_URLS, SKY_HD } from './fileInventory';
import { hdGeometry } from './modelIntake';
import { bakeKeeperFigure } from './keeperFigure';

export const HERO_LIBRARY_INPUTS: readonly string[] = [HD_URLS['keeper-hd']];
export interface HeroLibraryRows {
  pool: { url: string; parts: string[] };
  models: { name: string; url: string; geometry: string; releaseImage: true; pivots?: (string | null)[] }[];
}
function modelRow(value: unknown): value is HeroLibraryRows['models'][number] {
  return typeof value === 'object' && value !== null &&
    'name' in value && typeof value.name === 'string' && 'url' in value && typeof value.url === 'string' &&
    'geometry' in value && typeof value.geometry === 'string' && 'releaseImage' in value && value.releaseImage === true &&
    (!('pivots' in value) || (Array.isArray(value.pivots) && value.pivots.every((part: unknown) => part === null || typeof part === 'string'))) &&
    Object.keys(value).every(key => ['name', 'url', 'geometry', 'releaseImage', 'pivots'].includes(key));
}
function libraryRows(value: unknown): value is HeroLibraryRows {
  if (typeof value !== 'object' || value === null || !('pool' in value) || !('models' in value) || Object.keys(value).length !== 2) return false;
  const pool = value.pool;
  return typeof pool === 'object' && pool !== null && Object.keys(pool).length === 2 &&
    'url' in pool && typeof pool.url === 'string' && 'parts' in pool && Array.isArray(pool.parts) && pool.parts.every((part: unknown) => typeof part === 'string') &&
    Array.isArray(value.models) && value.models.every(modelRow);
}

/** Derive the original atlas/pivot inventory directly from the authored keeper geometry. */
export async function skyHeroLibrarySource(inputs: ReadonlyMap<string, Uint8Array>): Promise<HeroLibraryRows> {
  const bytes = inputs.get(HD_URLS['keeper-hd']);
  if (inputs.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error('Sky hero library input inventory differs');
  const source = await readSourceModel(bytes);
  const keeper = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
  if (keeper === null) throw new Error('Missing keeper author geometry');
  const pivots = bakeKeeperFigure(keeper.geometry).map((geometry, index) => geometry.getAttribute('position').count === 0 ? null : `hero-keeper-pivot-${String(index)}`);
  return { pool: { url: '/assets/far-reach/baked/prepared-models.glb', parts: [...SKY_HD.map(name => `hero-${name}`), ...pivots.filter((part): part is string => part !== null)] },
    models: SKY_HD.map(name => name === 'keeper-hd' ? { name, url: HD_URLS[name], geometry: `hero-${name}`, releaseImage: true, pivots }
      : { name, url: HD_URLS[name], geometry: `hero-${name}`, releaseImage: true }) };
}

/** Re-admit the complete original metadata on hits; no ignored JSON file is read. */
export async function skyHeroLibraryProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<HeroLibraryRows> {
  const files = await ctx.cached({ id: 'hero-library', native: true, inputs: HERO_LIBRARY_INPUTS }, async inputs =>
    new Map([['heroes.json', new TextEncoder().encode(`${JSON.stringify(await skyHeroLibrarySource(inputs))}\n`)]]));
  const bytes = files.get('heroes.json');
  if (files.size !== 1 || bytes === undefined || hashImmutableBytes(bytes) !== '8636a32d64c0cffec7c174e8f3983ca6a5d585e3bea4bd00463084dd1d85ac12') throw new Error('Sky hero library cache identity differs');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!libraryRows(value)) throw new Error('Sky hero library rows differ');
  return value;
}
