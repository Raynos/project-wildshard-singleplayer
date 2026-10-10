import type { ShardContext } from '@wildshard/game/shard/context';
/**
 * The skinning beat's first-person knife (PINE-HOLLOW-REMASTER §5 Polish, on PH-F2's beat): a gloved right hand holding a
 * drop-point skinning knife at the lower right of the view, in the lever-action's style — a Blender model
 * (scripts/blender/pine-hollow/weapons/skinning_knife.py → `public/assets/pine-hollow/weapons/skinning-knife[.phone].glb`, ONE mesh,
 * one baked atlas: albedo / normal / ARM) on the viewmodels' shared lit program (Crossbow.viewmodelMaterial: no program of
 * its own, lit with the scene: the sun, the CSM shadows, the fog). Debug ▸ Skinning knife = Stand-in — or a failed load — draws a procedural
 * stand-in (a steel blade, a walnut handle, a leather fist) on the same program. The SDK's held tool
 * (@wildshard/sdk/kit/heldTool) over the row ../data/skinningKnifeLook.ts `KNIFE_LOOK`.
 *
 *   const knife = new SkinKnife(game, sky, ctx);   // parented to the camera, hidden; starts the GLB fetch
 *   knife.update(beatT);                           // every frame: −1 = hidden; 0 … BEAT.len = the beat's clock (lifeMath.BEAT)
 *
 * The motion follows the beat: it rises into view as the view kneels (0 → kneelIn), then two strokes — each a short
 * wind-up and a fast draw down and across the hide that lands on `BEAT.cuts[i]` (the flesh sound, the kick) — and it
 * drops out of view from `BEAT.rise`. One draw while shown (the holstered weapon's are gone then), none otherwise.
 */
import type { Game } from '@wildshard/engine/core/Game';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { HeldTool, heldToolSpecimen, type HeldToolRow } from '@wildshard/sdk/kit/heldTool';
import { KNIFE_LOOK } from '../data/skinningKnifeLook';
import { BEAT } from '../life/lifeMath';

/** the Blender knife's file */
export const KNIFE_MODEL_URL = '/assets/pine-hollow/weapons/skinning-knife.glb';
/** the knife's row with its file */
const KNIFE: HeldToolRow = { ...KNIFE_LOOK, url: KNIFE_MODEL_URL };

/** The knife the skinning beat raises (one copy, src/shards/pine-hollow/life/index.ts). */
export class SkinKnife extends HeldTool {
  /** parented to `game`'s camera, hidden; fetches the GLB once the level has loaded */
  constructor(game: Game, sky: Sky, ctx: ShardContext) {
    super(game, sky, ctx, KNIFE, BEAT, (fetch) => {
      // fetched once booted (off the load's requests and bytes)
      let scheduled = false;
      ctx.on('level.loaded', ({ id }) => { if (id !== ctx.manifest.slug || scheduled) return; scheduled = true; ctx.scope.timeout(KNIFE.loadDelayMs, fetch); });
    });
  }
}

// ───────────────────────────── the model (E306 / E315 M5: Gear) ─────────────────────────────

/**
 * The skinning knife in a gloved hand: the Blender model (scripts/blender/pine-hollow/weapons/skinning_knife.py →
 * public/assets/pine-hollow/weapons/skinning-knife[.phone].glb, one mesh, one baked atlas), the procedural stand-in when it
 * does not load. One copy: the skinning beat raises it at a kill (`SkinKnife`, src/shards/pine-hollow/life/index.ts). The
 * Model Explorer's specimen loads its own copy (the phone tier's file on a phone; parsed once per shard), opaque.
 */
export const skinningKnife: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/skinning-knife', name: 'Skinning knife', category: 'gear', pipeline: ['blender', 'code'], file: 'src/shards/pine-hollow/models/skinningKnife.ts',
  defaults: {},
  build: (ctx) => heldToolSpecimen(ctx, skinningKnife.id, KNIFE, 'gear:skinning-knife'),
});
