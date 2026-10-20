import {ProjectedTrail} from '@wildshard/game/shardfile/clientTrails';
import trailRows from '../../boot/bowTrail.generated.json' with {type:'json'};
import { sourceMultiplier, type SourceMulDef } from '@wildshard/engine/combat/effects/types';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';
import type { BowInstance } from '@wildshard/sdk/runtime/weapons/starterBow';




/**
 * The Golden Bow — the Golden King's legendary reward (elites-and-bosses.md §2 "5 — Victory"; mockup
 * art/nalati-grasslands/round-2/5-bosses/boss-4-victory-reward.jpg): "a Scythian recurve with golden ibex-head limb tips and
 * a string of light … it draws 20 % faster than the recurve. A full draw fires a SUN ARROW that pierces through one target
 * and leaves a gold streak. A sun arrow into a balbal's amber crack shatters it."
 *
 * GoldenBow uses the native Bow owner directly. The reward replaces the original bow in its slot and keeps its quiver,
 * mounted state and composed source multipliers. GoldenBowPower owns the preloaded sun streak and piercing timeline;
 * its update clock stays with the boss runtime. The golden draw boost survives mounted gait and rear-shot adjustments.
 */

export interface GoldenBowDeps {
  scene: THREE.Scene;
  sky: Sky;
  camera: THREE.Camera;
  multipliers: readonly SourceMulDef[];
  /** the animals' ray test (AnimalManager.raycast): nearest hit along a straight segment */
  raycast: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => { animal: PierceTarget; point: THREE.Vector3; distance: number; headshot: boolean; damage: number } | null;
}
export interface PierceTarget { kind: string; alive: boolean; applyDamage: (amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3) => boolean }

const SPEED_BASE = 30, SPEED_DRAW = 28, SUN_DRAW = 0.95;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class GoldenBowPower {
  private bow: BowInstance | null = null;
  private readonly trail:ProjectedTrail;
  private pending: { t: number; target: PierceTarget; point: THREE.Vector3; dir: THREE.Vector3; dmg: number }[] = [];
  private sunShot = false;

  constructor(private readonly deps: GoldenBowDeps) {
    if(trailRows.points>48)throw new Error('Bow prediction exceeds its native contact bound');
    this.trail=new ProjectedTrail(deps.scene,deps.camera,trailRows);
  }

  get applied(): boolean { return this.bow !== null; }

  /** upgrade the bow in place (idempotent) */
  apply(bow: BowInstance): void {
    bow.row = { ...bow.row, id: 'weapon.golden-bow', meta: { ...bow.meta, name: 'Golden Bow' } };
    if (this.bow === bow) return;
    this.bow = bow;
    this.recolour(bow);
    bow.drawSpeedScale *= 1.2;
    // the power owns the bow's loose hook (no other writer; a GoldenBow built over a plain bow carries it over)
    bow.onLoose = (p) => { this.loosed(p); };
    const prevMul = bow.damageMultiplier;
    bow.damageMultiplier = (hit) => {
      const base = prevMul?.(hit) ?? 1;
      return base * sourceMultiplier(this.deps.multipliers, { weaponTags: ['weapon.golden-bow'],
        sourceTags: this.sunShot ? ['arrow.sun'] : [], targetTags: [`creature.${hit.animal.kind}`] });
    };
  }

  /** gold limbs, a string of light: B2's first-class bow style (Bow.setStyle repaints the limbs + string, the fist keeps its leather) */
  private recolour(bow: BowInstance): void { bow.setStyle('golden'); }

  private loosed(p: number): void {
    const bow = this.bow;
    this.sunShot = p >= SUN_DRAW;
    if (bow === null || !this.sunShot) return;
    // the path this arrow flies (the arrow's own integrator), from the camera along the aim
    const cam = this.deps.camera;
    cam.getWorldDirection(_d);
    _o.setFromMatrixPosition(cam.matrixWorld).addScaledVector(_d, 0.55);
    _v.copy(_d).multiplyScalar(SPEED_BASE + SPEED_DRAW * p).add(bow.carrierVelocity);
    const n = bow.arrows.predict(_o, _v, this.trail.points, trailRows.points, 0.6, 2.5);   // from 2.5 m out: a streak, not a bar across the view
    this.trail.show(n);
    // the pierce: walk the path; the first animal is the arrow's own hit, the second takes the sun arrow through it
    let first: PierceTarget | null = null, travelled = 0;
    let ax = _o.x, ay = _o.y, az = _o.z;
    for (let i = 0; i < 48; i++) {
      if(i>=n)break;
      const bx = this.trail.points[i * 3] ?? ax, by = this.trail.points[i * 3 + 1] ?? ay, bz = this.trail.points[i * 3 + 2] ?? az;
      _a.set(ax, ay, az); _b.set(bx - ax, by - ay, bz - az);
      const len = _b.length();
      if (len > 1e-3) {
        _b.multiplyScalar(1 / len);
        let from = 0;
        for (let guard = 0; guard < 3; guard++) {
          const hit = this.deps.raycast(_a.set(ax, ay, az).addScaledVector(_b, from), _b, len - from);
          if (hit === null) break;
          if (first === null) { first = hit.animal; from += hit.distance + 1.2; continue; }
          if (hit.animal !== first && hit.animal.alive) {
            const dist = travelled + from + hit.distance;
            this.pending.push({ t: dist / (SPEED_BASE + SPEED_DRAW * p), target: hit.animal, point: hit.point.clone(), dir: _b.clone(), dmg: Math.round(hit.damage * 1.2) });
            return;
          }
          from += hit.distance + 1.2;
        }
      }
      travelled += len; ax = bx; ay = by; az = bz;
    }
  }

  update(dt: number): void {
    this.trail.advance(dt);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      if (q === undefined) continue;
      q.t -= dt;
      if (q.t > 0) continue;
      this.pending.splice(i, 1);
      if (!q.target.alive) continue;
      const balbal = q.target.kind === 'balbal' || q.target.kind === 'kurgan-balbal';
      q.target.applyDamage(balbal ? q.dmg * 3 : q.dmg, q.point, q.dir);
    }
  }
}
