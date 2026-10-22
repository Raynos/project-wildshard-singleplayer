/**
 * Nine Dragon Stack's gear (E306 / E315 M5, `gear`): what the fragment's player holds — the first-person arms with the Neon
 * Jian in the right hand and the Fei Zhua gauntlet on the left (the game's graph arms from weapons/jian-row.json, swung by
 * the engine's Sword). That is the whole kit: no rifle slot on a sword shard (E333), no iron sword (E314 A: nothing here unlocks it).
 */
import { specimens } from '../boot/metadata.generated.json' with { type: 'json' };
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { graphArmsSpecimen } from '@wildshard/game/systems/viewmodel/graphArms';

const rows = specimens.gear;

/**
 * The first-person arms: fp-rig.glb — both arms (shoulder to hand, the twist bones), the Neon Jian a rigid child of the
 * right hand (its dragon-head guard from a TRELLIS.2 generation, cleaned in Blender), the Fei Zhua gauntlet and its claw on
 * the left; the parts modelled and baked in Blender (scripts/blender/nine-dragon-stack/viewmodel/), skinned, ink-hulled
 * and given its 16 clips by the lab's three.js bake — plus what the rig builds in code: the verlet tassel and talisman,
 * the knot, the edge halo, the ink trail. Camera space, as held: the eye at the origin, −Z forward.
 */
export const fpArms: ModelDef<object> = defineModel<object>({
  ...rows.model, category: 'gear', pipeline: ['blender', 'trellis', 'code'],
  rig: { clips: rows.clips },
  build: (ctx) => loadingSpecimen(fpArms.id, [0.9, 0.6, 0.9], () => graphArmsSpecimen('nine-dragon-stack', 'weapons/jian-row.json', rows.settleFrames, ctx.renderer)),
});

/** the fragment's kit (src/main.ts, `weapon: 'sword'`): the jian arms alone — no rifle slot (E333), no iron sword (E314 A) */
export const GEAR: readonly RosterEntry[] = [
  live(fpArms, { copies: 1 }),
];
