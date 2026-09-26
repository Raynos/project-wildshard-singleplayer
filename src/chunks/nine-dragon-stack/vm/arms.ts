// Nine Dragon Stack's first-person arms in the engine (P0-5c; lab P8's rig, round 13, art/nine-dragon-stack/round-13-
// viewmodel-rig/): NineDragonArms (fpArms.ts) as the engine Sword's animated rig (Sword.ts `SwordArms`). The engine keeps
// its moves, input, lunge, hit-stop and damage; this maps its move names onto the rig's clips (whose timings are the
// engine's: light = SLASH, light2 = BACKHAND, light3 = FINISHER, heavy = HEAVY after charge), feeds it the walk and the
// look, and hands the blade back for the hit sweep.
//
// The viewmodel's own projection: the clips are framed for a 70° vertical field on the portrait phone (the mockups'
// look), and the world camera is ~100° there. The rig's camera-space x and y are scaled by tan(world fov / 2) /
// tan(70° / 2) with z kept, which draws it exactly as a 70° camera would. The world's FOV kicks (dodge, the heavy's
// punch) then leave the arms still. The depth clear in front of the viewmodel queue (Sword.ts) keeps them out of the
// walls.
import { Quaternion, Vector3 } from 'three';
import type { ShardSword } from '../../ChunkDef';
import type { SwordArms } from '../../../player/Sword';
import type { Move } from '../../../player/SwordMoves';
import { type MoveName, NineDragonArms } from './fpArms';

/** the viewmodel's vertical field (degrees): the clips' canonical camera */
const VM_FOV = 70;

/** the engine's moves → the rig's clips (the sabre's passes never reach this sword) */
const CLIP: Readonly<Record<Move['name'] | 'charge', MoveName>> = {
  slash: 'light', backhand: 'light2', finisher: 'light3', heavy: 'heavy', charge: 'charge', 'pass-left': 'light', 'pass-right': 'light2',
};

/** the fp-rig and its maps, declared by the def so the loading bar counts them and the offline cache holds them */
export const ARMS_FILES = [
  'fp-rig.glb', ...['hand-r', 'arm-r', 'fist-l', 'gauntlet'].flatMap((n) => [`${n}-maps.webp`, `${n}-nrm.webp`]),
].map((f) => `/assets/nine-dragon/viewmodel/${f}`);

/** the rig as the Sword's arms (ChunkDef.sword) */
export async function jianArms(): Promise<ShardSword> {
  const rig = await NineDragonArms.load();
  // out of n8ao's transparency pre-pass (Game.ts): it re-drew every depth-writing transparent — the whole rig, 25 draws /
  // 220 k triangles — only to mask the AO off it; the viewmodel queue's depth clear keeps the AO's world depth behind it
  rig.root.traverse((o) => { o.userData['treatAsOpaque'] = true; });
  const gravity = new Vector3(), q = new Quaternion();
  let bw = 0, bh = 0, pr = 0, k = 1;
  const arms: SwordArms = {
    root: rig.root,
    play: (move) => { rig.play(CLIP[move]); },
    update: (dt, s) => {
      const cam = s.camera, r = s.renderer;
      // the viewmodel's projection
      k = Math.tan((cam.fov * Math.PI) / 360) / Math.tan((VM_FOV * Math.PI) / 360);
      rig.root.scale.set(k, k, 1);
      rig.root.position.set(0, 0, 0);
      // the ink widths and the halo are in buffer pixels
      const w = r.domElement.width, h = r.domElement.height, p = r.getPixelRatio();
      if (w !== bw || h !== bh || p !== pr) { bw = w; bh = h; pr = p; rig.resize(w, h, p); }
      // gravity in the rig's space: the world's down turned into the camera's, un-scaled by the projection
      gravity.set(0, -9.8, 0).applyQuaternion(cam.getWorldQuaternion(q).invert());
      gravity.set(gravity.x / k, gravity.y / k, gravity.z);
      rig.update(dt, { speed: s.speed, walkPhase: s.walkPhase, lookVel: s.lookVel, gravity });
    },
    blade: (base, tip) => {
      rig.blade(base, tip);
      rig.root.updateMatrix();
      base.applyMatrix4(rig.root.matrix);
      tip.applyMatrix4(rig.root.matrix);
    },
  };
  return { arms };
}
