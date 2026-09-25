/**
 * A round of kokpar (NALATI-MERGE Q3 — TULPAR's second step; there was no kokpar game, so this is the ride-through
 * challenge at the kokpar field, with its six galloping riders around you). The goat (the serke: a painterly carcass,
 * one merged mesh) lies in the middle of the trodden oval.
 *
 *   1. Ride in MOUNTED (any horse: Tulpar, Argymaq, a camp horse) and pass over the goat: you snatch it up (it hangs
 *      at the horse's flank).
 *   2. Drop it in either tai-qazan (the turf goal rings at the oval's ends) within 45 s.
 *   3. Keep moving: 2.5 s at a trot or slower and a rider snatches it back (to the middle). Dismounting drops it, and so
 *      does riding off the field.
 *
 * Open any time, quest or not (the bosses' rule: content stays open, the quest catches up) — `onWin` raises
 * `won:kokpar`. Dev: `win()` (window.__nalatiQuest.kokpar.win()).
 *
 *   const k = buildKokparRound(sky, floorAt, { toast, sting, onWin });
 *   k.update(dt, player.position, mount)       // every frame
 */
import * as THREE from 'three';
import { PaintKit, pole, v3, blob, poiMaterial } from '../world/nalati/paint';
import { KOKPAR } from '../chunks/nalatiLayout';
import type { Sky } from '../world/Sky';

/** a point on the field's oval at angle t, scaled by k (1 = its edge) — Bowl.ts buildKokpar's own `onOval` */
export function kokparOval(t: number, k: number): { x: number; z: number } {
  const c = Math.cos(KOKPAR.rot), s = Math.sin(KOKPAR.rot);
  const lx = Math.cos(t) * KOKPAR.rx * k, lz = Math.sin(t) * KOKPAR.rz * k;
  return { x: KOKPAR.x + lx * c + lz * s, z: KOKPAR.z - lx * s + lz * c };
}
/** the two tai-qazan (Bowl.ts: onOval(0 | π, 0.82)) */
export const KOKPAR_GOALS = [kokparOval(0, 0.82), kokparOval(Math.PI, 0.82)];

const PICK_R = 3.6, GOAL_R = 3.6, FIELD_R = Math.max(KOKPAR.rx, KOKPAR.rz) + 22, ROUND_T = 45, SLOW_T = 2.5;

export interface KokparMount {
  readonly mounted: boolean;
  readonly gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop';
  readonly horse: { position: THREE.Vector3; yaw: number } | null;
}
export interface KokparHost {
  toast: (text: string) => void;
  sting: (kind: 'pickup' | 'win' | 'lose') => void;
  onWin: () => void;
}

export interface KokparRound {
  object: THREE.Object3D;
  readonly carrying: boolean;
  update: (dt: number, player: THREE.Vector3, mount: KokparMount | null) => void;
  /** dev / the harness: a won round */
  win: () => void;
}

/** the goat: a painterly carcass lying on its side (body, legs, head, the horns) */
function goatMesh(sky: Sky): THREE.Mesh {
  const kit = new PaintKit(0x9047);
  const hide = '#8a7457', dark = '#5b4a3a', horn = '#3a302a';
  kit.add(blob(0.36, kit.rng, 2, 1, 0.12).scale(1.55, 0.62, 0.8), hide, { brush: 0.18 });
  for (const [x, z] of [[0.36, 0.14], [0.3, -0.14], [-0.36, 0.14], [-0.32, -0.14]] as const) kit.add(pole(v3(x, 0, z), v3(x * 1.12, -0.12, z * 2.9), 0.045, 0.03, 6), dark);
  kit.add(blob(0.13, kit.rng, 1, 0.9, 0.1).scale(1.5, 0.9, 0.9).translate(0.66, 0.02, 0.04), hide);
  for (const s of [-1, 1]) kit.add(pole(v3(0.72, 0.11, s * 0.05), v3(0.6, 0.26, s * 0.1), 0.022, 0.008, 5), horn);
  const m = new THREE.Mesh(kit.finish({ ao: false }), poiMaterial(sky));
  m.castShadow = true; m.receiveShadow = true;
  m.name = 'nalati-kokpar-goat';
  return m;
}

export function buildKokparRound(sky: Sky, floorAt: (x: number, z: number) => number, host: KokparHost): KokparRound {
  const goat = goatMesh(sky);
  const home = new THREE.Vector3(KOKPAR.x, 0, KOKPAR.z);
  home.y = floorAt(home.x, home.z) + 0.16;
  const lie = (): void => { goat.position.copy(home); goat.rotation.set(0, 0.7, Math.PI / 2 - 0.25); };
  lie();
  let carrying = false, left = 0, slow = 0, cheerT = 0, warned = false;
  const drop = (why: string): void => { carrying = false; lie(); host.toast(why); host.sting('lose'); };

  const win = (): void => {
    carrying = false;
    host.toast('TAI-QAZAN! The riders roar and fling their hats — the round is yours');
    host.sting('win');
    host.onWin();
    cheerT = 4;
  };

  return {
    object: goat,
    get carrying() { return carrying; },
    win,
    update(dt, player, mount) {
      if (cheerT > 0) { cheerT -= dt; if (cheerT <= 0) lie(); }
      const dx = player.x - KOKPAR.x, dz = player.z - KOKPAR.z;
      if (!carrying) {
        if (cheerT > 0 || mount?.mounted !== true || dx * dx + dz * dz > FIELD_R * FIELD_R) return;
        if (Math.hypot(player.x - goat.position.x, player.z - goat.position.z) < PICK_R) {
          carrying = true; left = ROUND_T; slow = 0; warned = false;
          host.toast('You have the goat! Into a tai-qazan — keep galloping, the riders are on you');
          host.sting('pickup');
        }
        return;
      }
      // carrying: on the horse's flank
      const h = mount?.horse ?? null;
      if (mount?.mounted !== true || h === null) { drop('You let go of the goat — it goes back to the middle'); return; }
      if (dx * dx + dz * dz > FIELD_R * FIELD_R) { drop('Off the field — the goat goes back to the middle'); return; }
      left -= dt;
      if (left <= 0) { drop('Time! The riders take the goat back'); return; }
      if (!warned && left < 15) { warned = true; host.toast('15 seconds — find a tai-qazan!'); }
      slow = mount.gait === 'canter' || mount.gait === 'gallop' ? Math.max(0, slow - dt) : slow + dt;
      if (slow > SLOW_T) { drop('A rider leans in and snatches the goat back — keep moving!'); return; }
      const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
      goat.position.set(h.position.x + c * 0.62, h.position.y + 1.02, h.position.z - s * 0.62);
      goat.rotation.set(0, h.yaw + Math.PI / 2, 0.35);
      for (const g of KOKPAR_GOALS) if (Math.hypot(h.position.x - g.x, h.position.z - g.z) < GOAL_R) {
        win();
        goat.position.set(g.x, floorAt(g.x, g.z) + 0.9, g.z);
        goat.rotation.set(0, 0.3, Math.PI / 2 - 0.2);
        return;
      }
    },
  };
}
