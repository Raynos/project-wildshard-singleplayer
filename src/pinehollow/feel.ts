import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { AnimalManager } from '../entities/AnimalManager';
import type { Weapons } from '../player/Weapons';
import { worldHit } from '../player/Crossbow';
import { CameraFX } from '../player/CameraFX';
import { Impacts, type ImpactKind } from '../fx/Impacts';
import { GroundTell } from '../game/Elite';
import { boltHitStop } from './combatMath';

/**
 * Pine Hollow's COMBAT FEEL for the ranged kit (PINE-HOLLOW-REMASTER PH-F1): Driftwood's melee kit (Driftwood C2–C4:
 * Game.hitStop, CameraFX kick + trauma shake, Impacts debris, the hurt arc) ported to bolts.
 *
 *   · HIT-STOP — a bolt that lands stops the world for 35 ms (the head 55, a kill 75; the sword's are 60 / 90 / 140 —
 *     a bolt is felt at range, so less), and the camera takes a small kick (more on a kill).
 *   · TRAUMA — big hits shake: a kill of a bear, an elk or anything named, a headshot on the King.
 *   · IMPACTS BY SURFACE — where a bolt lands off an animal, debris by what it hit (the physics query's material under the
 *     point): wood → splinters; rock / stone → granite chips + a few sparks off the broadhead; the forest floor → earth and
 *     needles. (Flesh is the AnimalManager's blood; the King's bark throws its own splinters — antlerKing.ts.)
 *   · CHARGE TELLS — a wild bear or boar that charges you paints its lane on the ground (GroundTell) for as long as it runs:
 *     the dodge reads before the hit. (The elites and the King paint their own.)
 *   · THE HURT ARC + SHAKE when something hits you: main.ts's onCharge, now on for Pine Hollow as well as the island.
 *
 *   const feel = installPineFeel({ game, weapons, animals });   feel.update(dt, t)   // every frame
 */

const BIG = new Set(['bear', 'elk', 'antler-king']);
const TELL = new THREE.Color(2.2, 0.7, 0.28);
const TELL_R = 45, LANES = 3;

const _dir = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export interface PineFeel { update: (dt: number, t: number) => void }

export function installPineFeel(o: { game: Game; weapons: Weapons; animals: AnimalManager }): PineFeel {
  const { game, weapons, animals } = o;
  const fx = CameraFX.for(game);
  const impacts = Impacts.for(game); // built into the scene now, before the boot's precompile
  // ── hit-stop + kick + trauma on every bolt that lands ──
  const prevHit = weapons.onHit;
  weapons.onHit = (kind, headshot, killed) => {
    prevHit?.(kind, headshot, killed);
    game.hitStop(boltHitStop(headshot, killed));
    fx.kick(killed ? 0.9 : headshot ? 0.6 : 0.35, (Math.random() - 0.5) * (killed ? 1.2 : 0.6));
    if ((killed && BIG.has(kind)) || (headshot && kind === 'antler-king')) fx.addTrauma(killed ? 0.28 : 0.15);
  };
  // ── debris by surface ──
  const prevImpact = weapons.onImpact;
  weapons.onImpact = (surface, point) => {
    prevImpact?.(surface, point);
    if (surface === 'flesh') return;
    const cam = game.camera.position;
    _dir.subVectors(point, cam).normalize();
    _a.copy(point).addScaledVector(_dir, -0.4); _b.copy(point).addScaledVector(_dir, 0.6);
    const m = surface === 'wood' ? 'wood' : worldHit(_a, _b, 0)?.material ?? 'ground';
    const kind: ImpactKind = m === 'wood' || m === 'planks' ? 'wood' : m === 'rock' || m === 'stone' || m === 'metal' ? 'stone' : 'dirt';
    _dir.negate(); // back toward the shooter
    impacts.burst(kind, point, _dir, kind === 'wood' ? 8 : 9);
    if (kind === 'stone') impacts.burst('sparks', point, _dir, 4);
  };
  // ── the charge lanes of the wild bears and boars ──
  const tells = Array.from({ length: LANES }, () => new GroundTell(game.scene, 'lane', TELL));
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
