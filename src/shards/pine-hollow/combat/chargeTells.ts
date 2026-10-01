import * as THREE from 'three';
import { type Game, installRangedFeel, type EquipmentService, type AnimalManager } from '#engine';




import { CROSSBOW, LEVER, LONGBOW } from '../weapons/equipment';

/** Shared ranged presentation plus the charge lanes authored for this level. */


interface ChargeTell { setTime: (t: number) => void; lane: (x: number, z: number, tx: number, tz: number, width: number, opacity: number) => void; hide: () => void }
const TELL = new THREE.Color(2.2, 0.7, 0.28);
const TELL_R = 45, LANES = 3;



export interface PinePresentation { update: (dt: number, t: number) => void }

export function installPinePresentation(o: { game: Game; weapons: EquipmentService; animals: AnimalManager; makeTell: (color: THREE.Color) => ChargeTell }): PinePresentation {
  const { game, weapons, animals } = o;
  if (weapons.events) installRangedFeel(game, weapons.events, game.levelScope, (id) => [CROSSBOW, LEVER, LONGBOW].find((row) => row.id === id));
  // ── the charge lanes of the wild bears and boars ──
  const tells = Array.from({ length: LANES }, () => o.makeTell(TELL));
  return {
    update: (_dt, t) => {
      const p = game.camera.position;
      let n = 0;
      for (const a of animals.animals) {
        if (n >= LANES) break;
        if (!a.alive || a.hidden || !a.aggressive || a.state !== 'charge') continue;
        const dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz);
        if (d > TELL_R || d < 1.5) continue;
        const tell = tells[n++];
        if (tell === undefined) break;
        // along the way it is running (its heading), as far as you and a little past
        const fx0 = Math.sin(a.yaw), fz0 = Math.cos(a.yaw), len = d + 4;
        tell.setTime(t);
        tell.lane(a.position.x, a.position.z, a.position.x + fx0 * len, a.position.z + fz0 * len, 2.2 * Math.max(1, a.scale * 0.8), 0.55 + 0.2 * Math.sin(t * 18));
      }
      for (let i = n; i < LANES; i++) tells[i]?.hide();
    },
  };
}
