// Frozen shipping round before the AS projection (2026-10-18).
import * as THREE from 'three';
import { poiMaterial } from '../../src/shards/nalati-grasslands/world/modelView';
import { bakedActorGeometry } from '../../src/shards/nalati-grasslands/world/places';
import layoutRows from '../../src/shards/nalati-grasslands/boot/layout.generated.json' with { type: 'json' };
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const { KOKPAR } = layoutRows;

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
  const m = new THREE.Mesh(bakedActorGeometry('goat'), poiMaterial(sky));
  m.castShadow = true; m.receiveShadow = true;
  m.name = 'nalati-kokpar-goat';
  return m;
}

export function buildKokparRound(sky: Sky, floorAt: (x: number, z: number) => number, host: KokparHost, goat = goatMesh(sky)): KokparRound {
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
        // (a practice room hangs over the shard: the horse playground's track passes over the kokpar field, E307)
        if (cheerT > 0 || mount?.mounted !== true || practiceRoom.open || dx * dx + dz * dz > FIELD_R * FIELD_R) return;
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
