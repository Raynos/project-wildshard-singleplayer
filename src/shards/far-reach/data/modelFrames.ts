import { DAIS } from './layout';
import { LECTERN } from './bookStand';
import { TREE_MODELS, TREES } from './trees';
import type { SkyHdName } from './files';

/** A finite model's static fitting rule, consumed only by the retained author generator. */
interface StaticModelFit { readonly size: number; readonly by: 'height' | 'span'; readonly floor: number; readonly centre: 'base' }

/** Exact static fits previously applied by each native world owner. */
export const MODEL_FITS: Readonly<Partial<Record<SkyHdName, StaticModelFit>>> = {
  ...Object.fromEntries(TREE_MODELS.map(name => [name, { size: TREES[name].height, by: 'height', floor: -0.15, centre: 'base' }])),
  'post-hd': { size: 1.9, by: 'height', floor: 0, centre: 'base' },
  'crown-stone': { size: 1, by: 'height', floor: 0, centre: 'base' },
  'crown-stone-b': { size: 1, by: 'height', floor: 0, centre: 'base' },
  'crown-dais': { size: DAIS.r * 2, by: 'span', floor: 0, centre: 'base' },
  'lectern-hd': { size: LECTERN.height, by: 'height', floor: 0, centre: 'base' },
  'lantern-hd': { size: LECTERN.lantern, by: 'height', floor: 0, centre: 'base' },
} as const;

/** The crown's native carved-set dimensions; motion and material owners remain native. */
export const CARVED = { yaw: 0, daisH: 0.42, sink: 0.15 } as const;
/** The standard geometry-only GLB; original painted textures remain their existing assets. */
export const PREPARED_MODELS_URL = '/assets/far-reach/baked/prepared-models.glb';

/** Authored facet AO floor shared by model and offline mesh readers. */
export const SKY_AO_FLOOR = 0.6;
