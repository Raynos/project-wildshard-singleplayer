/**
 * Nine Dragon Stack's gear (E306 / E315 M5, `gear`): what the fragment's player holds — the first-person arms with the Neon
 * Jian in the right hand and the Fei Zhua gauntlet on the left (vm/fpArms.ts, swung by the engine's Sword through
 * vm/arms.ts). That is the whole kit: no rifle slot on a sword shard (E333), no iron sword (E314 A: nothing here unlocks it).
 */
import * as THREE from 'three';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { NineDragonArms } from '../vm/fpArms';

/** fp-rig.glb's clips (scripts/blender/nine-dragon-stack/viewmodel/rig/check-clips.mjs holds them to moves.ts): the right
 *  arm's base loops, cuts, charge and parry, the draw and sheathe; the left arm's loops and the grapple's poses */
export const FP_ARMS_CLIPS: readonly string[] = [
  'idle', 'walk', 'light', 'light2', 'light3', 'charge', 'heavy', 'parry', 'sheathe', 'draw', 'sheathed',
  'idleL', 'walkL', 'grapple_aim', 'grapple_fire', 'grapple_hold',
];

/** frames of the idle the specimen is stepped through before it stands: the tassel and the talisman settle and hang */
const SETTLE_FRAMES = 45;

/**
 * The rig standing still: its own `NineDragonArms` — its own parse of the GLB, its own maps, materials, uniforms and mixer,
 * nothing shared with the held rig — stepped through the idle's first ¾ s with no walk and no look so the cloth hangs, then
 * left there. Its ink hulls and the edge halo are sized in drawing-buffer pixels: every mesh re-reads the buffer it is
 * drawn into (the held rig's arms.ts does it per frame). Out of n8ao's transparency pre-pass, as the held rig is (arms.ts).
 */
function standStill(rig: NineDragonArms, renderer: Renderer | null): THREE.Object3D {
  const still = { speed: 0, lookVel: new THREE.Vector2(), gravity: new THREE.Vector3(0, -9.8, 0) };
  for (let i = 0; i < SETTLE_FRAMES; i++) rig.update(1 / 60, still);
  let bw = 0, bh = 0, pr = 0;
  const fit = (r: Renderer): void => {
    const c = r.domElement, p = r.getPixelRatio();
    if (c.width === bw && c.height === bh && p === pr) return;
    bw = c.width; bh = c.height; pr = p;
    rig.resize(bw, bh, pr);
  };
  if (renderer) fit(renderer);
  // the ink trail is an effect of a swing, not the arms: its empty strip (every vertex at the eye) would stretch the card's
  // bounds to the camera's origin and shrink the arms on the turntable
  rig.trail.mesh.removeFromParent();
  rig.root.traverse((o) => {
    o.userData['treatAsOpaque'] = true;
    if (o instanceof THREE.Mesh) o.onBeforeRender = (r) => { fit(r); };
  });
  return rig.root;
}

/**
 * The first-person arms: fp-rig.glb — both arms (shoulder to hand, the twist bones), the Neon Jian a rigid child of the
 * right hand (its dragon-head guard from a TRELLIS.2 generation, cleaned in Blender), the Fei Zhua gauntlet and its claw on
 * the left; the parts modelled and baked in Blender (scripts/blender/nine-dragon-stack/viewmodel/), skinned, ink-hulled
 * and given its 16 clips by the lab's three.js bake — plus what the rig builds in code: the verlet tassel and talisman,
 * the knot, the edge halo, the ink trail. Camera space, as held: the eye at the origin, −Z forward.
 */
export const fpArms: ModelDef<object> = defineModel<object>({
  id: 'nine-dragon-stack/fp-arms', name: 'Arms: Neon Jian & Fei Zhua', category: 'gear', pipeline: ['blender', 'trellis', 'code'], file: 'src/shards/nine-dragon-stack/models/gear.ts',
  defaults: {},
  rig: { clips: FP_ARMS_CLIPS },
  build: (ctx) => loadingSpecimen(fpArms.id, [0.9, 0.6, 0.9], async () => standStill(await NineDragonArms.load(), ctx.renderer)),
});

/** the fragment's kit (src/main.ts, `weapon: 'sword'`): the jian arms alone — no rifle slot (E333), no iron sword (E314 A) */
export const GEAR: readonly RosterEntry[] = [
  live(fpArms, { copies: 1 }),
];
