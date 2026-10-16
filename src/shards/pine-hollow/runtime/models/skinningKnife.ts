import type { ShardContext } from '@wildshard/game/shard/context';
/**
 * The skinning beat's first-person knife (PINE-HOLLOW-REMASTER §5 Polish, on PH-F2's beat): a gloved right hand holding a
 * drop-point skinning knife at the lower right of the view, in the lever-action's style — a Blender model
 * (src/shards/pine-hollow/blender/weapons/skinning_knife.py → `public/assets/pine-hollow/weapons/skinning-knife[.phone].glb`, ONE mesh,
 * one baked atlas: albedo / normal / ARM) on the viewmodels' shared lit program (Crossbow.viewmodelMaterial: no program of
 * its own, lit with the scene: the sun, the CSM shadows, the fog). Debug ▸ Skinning knife = Stand-in — or a failed load — draws a procedural
 * stand-in (a steel blade, a walnut handle, a leather fist) on the same program. The SDK's held tool
 * (@wildshard/sdk/kit/heldTool) over the admitted custom/heldToolPlayback recipe.
 *
 *   const knife = new SkinKnife(game, sky, ctx);   // parented to the camera, hidden; fetches the GLB after the level loads
 *   knife.update(beatT);                           // every frame: −1 = hidden; 0 … the harvest beat's len (custom/ambientLife `harvest`)
 *
 * The motion follows the beat: it rises into view as the view kneels (0 → kneelIn), then two strokes — each a short
 * wind-up and a fast draw down and across the hide that lands on `BEAT.cuts[i]` (the flesh sound, the kick) — and it
 * drops out of view from `BEAT.rise`. One draw while shown (the holstered weapon's are gone then), none otherwise.
 */
import type { Game } from '@wildshard/engine/core/Game';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { HeldTool, heldToolSpecimen, type HeldToolRow } from '../kit/heldTool';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { SECTIONS } from '../sections';

/** the Blender knife's file */
export const KNIFE_MODEL_URL = '/assets/pine-hollow/weapons/skinning-knife.glb';
/** The page and cold Explorer read the same admitted recipe and playback. */
export function knifeRows(product: ShardProduct): HeldToolRow {
  const row = product.section('custom/heldToolPlayback', SECTIONS);
  return { ...row.look, url: KNIFE_MODEL_URL, playback: row.pose };
}
let prepared: HeldToolRow | null = null;
/** The manifest's existing async roster door prepares rows before listing models. */
export async function prepareKnifeRows(product?: ShardProduct): Promise<void> { prepared = knifeRows(product ?? await loadFirstPartyProduct('pine-hollow')); }
function preparedKnife(): HeldToolRow { if (prepared === null) throw new Error('Pine knife rows are not admitted'); return prepared; }

/** The knife the skinning beat raises (one copy, src/shards/pine-hollow/life/index.ts). */
export class SkinKnife extends HeldTool {
  /** parented to `game`'s camera, hidden; fetches the GLB `loadDelayMs` of game time after the level has loaded */
  constructor(game: Game, sky: Sky, ctx: ShardContext) {
    const row = knifeRows(ctx.product);
    super(game, sky, ctx, row, ctx.product.section('custom/ambientLife', SECTIONS).harvest, (load) => {
      // fetched row.loadDelayMs of game time after the level loads (off the load's requests and bytes), on the level's
      // own update system instead of a wall-clock timer
      let left = -1; // seconds to the fetch: −1 not scheduled yet, 0 fetched
      ctx.on('level.loaded', ({ id }) => { if (id === ctx.manifest.slug && left === -1) left = Math.max(row.loadDelayMs / 1000, 1e-6); });
      ctx.system({ id: 'shard.pine.knife.load', phase: 'update', run: (dt) => { if (left <= 0) return; left = Math.max(0, left - dt); if (left === 0) load(); } });
    });
  }
}

// ───────────────────────────── the model (E306 / E315 M5: Gear) ─────────────────────────────

/**
 * The skinning knife in a gloved hand: the Blender model (src/shards/pine-hollow/blender/weapons/skinning_knife.py →
 * public/assets/pine-hollow/weapons/skinning-knife[.phone].glb, one mesh, one baked atlas), the procedural stand-in when it
 * does not load. One copy: the skinning beat raises it at a kill (`SkinKnife`, src/shards/pine-hollow/life/index.ts). The
 * Model Explorer's specimen loads its own copy (the phone tier's file on a phone; parsed once per shard), opaque.
 */
export const skinningKnife: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/skinning-knife', name: 'Skinning knife', category: 'gear', pipeline: ['blender', 'code'], file: 'src/shards/pine-hollow/models/skinningKnife.ts',
  defaults: {},
  build: (ctx) => heldToolSpecimen(ctx, skinningKnife.id, preparedKnife(), 'gear:skinning-knife'),
});
