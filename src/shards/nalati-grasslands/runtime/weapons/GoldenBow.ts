import { sourceMultiplier } from '@wildshard/engine/combat/effects/types';
import { isMesh } from '@wildshard/engine/combat/view/ranged';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { NALATI_SOURCE_MULTIPLIERS, goldenSourceTags } from '../../weapons/effects';
import * as THREE from 'three';
import type { BowInstance } from '@wildshard/sdk/runtime/weapons/starterBow';
import { rewardBowType } from '@wildshard/sdk/items/rewardBow';
import { BOW } from '../../weapons/equipment';



import { fxMaterial, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';

/**
 * The Golden Bow — the Golden King's legendary reward (elites-and-bosses.md §2 "5 — Victory"; mockup
 * art/nalati-grasslands/round-2/5-bosses/boss-4-victory-reward.jpg): "a Scythian recurve with golden ibex-head limb tips and
 * a string of light … it draws 20 % faster than the recurve. A full draw fires a SUN ARROW that pierces through one target
 * and leaves a gold streak. A sun arrow into a balbal's amber crack shatters it."
 *
 * GoldenBow is a row over the platform's reward bow (SF36). The reward replaces the original bow in its slot and keeps its quiver,
 * mounted state and composed source multipliers. GoldenBowPower owns the preloaded sun streak and piercing timeline;
 * its update clock stays with the boss runtime. The golden draw boost survives mounted gait and rear-shot adjustments.
 */

export interface GoldenBowDeps {
  scene: THREE.Scene;
  sky: Sky;
  camera: THREE.Camera;
  /** the animals' ray test (AnimalManager.raycast): nearest hit along a straight segment */
  raycast: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => { animal: PierceTarget; point: THREE.Vector3; distance: number; headshot: boolean; damage: number } | null;
}
export interface PierceTarget { kind: string; alive: boolean; applyDamage: (amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3) => boolean }

const GOLD = new THREE.Color(0.78, 0.42, 0.07), GOLD_HI = new THREE.Color(1.0, 0.72, 0.26), GOLD_LO = new THREE.Color(0.36, 0.17, 0.03);
const STRING_LIGHT = new THREE.Color(3.2, 2.6, 1.3);
const STREAK_PTS = 48, SPEED_BASE = 30, SPEED_DRAW = 28, SUN_DRAW = 0.95;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Color();

export class GoldenBowPower {
  private bow: BowInstance | null = null;
  private streak: THREE.Mesh; private streakMat: FxMaterial; private streakPos: Float32Array; private streakAttr: THREE.BufferAttribute;
  private streakT = 0;
  private pts = new Float32Array(STREAK_PTS * 3);
  private pending: { t: number; target: PierceTarget; point: THREE.Vector3; dir: THREE.Vector3; dmg: number }[] = [];
  private sunShot = false;

  constructor(private readonly deps: GoldenBowDeps) {
    // the streak: a camera-facing ribbon along up to STREAK_PTS points (rewritten per shot)
    const g = new THREE.BufferGeometry();
    this.streakPos = new Float32Array(STREAK_PTS * 2 * 3);
    this.streakAttr = new THREE.BufferAttribute(this.streakPos, 3); this.streakAttr.setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(STREAK_PTS * 2 * 2), idx: number[] = [];
    for (let i = 0; i < STREAK_PTS; i++) {
      uv[i * 4] = i / (STREAK_PTS - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (STREAK_PTS - 1); uv[i * 4 + 3] = 1;
      if (i < STREAK_PTS - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    g.setAttribute('position', this.streakAttr);
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(STREAK_PTS * 2 * 3).fill(0), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.streakMat = fxMaterial(FX.streak, new THREE.Color(2.4, 1.6, 0.5), 0);
    this.streak = new THREE.Mesh(g, this.streakMat);
    this.streak.frustumCulled = false; this.streak.visible = false; this.streak.renderOrder = 16;
    deps.scene.add(this.streak);
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
      return base * sourceMultiplier(NALATI_SOURCE_MULTIPLIERS, { weaponTags: ['weapon.golden-bow'],
        sourceTags: goldenSourceTags(this.sunShot), targetTags: [`creature.${hit.animal.kind}`] });
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
    const n = bow.arrows.predict(_o, _v, this.pts, STREAK_PTS, 0.6, 2.5);   // from 2.5 m out: a streak, not a bar across the view
    this.writeStreak(n);
    // the pierce: walk the path; the first animal is the arrow's own hit, the second takes the sun arrow through it
    let first: PierceTarget | null = null, travelled = 0;
    let ax = _o.x, ay = _o.y, az = _o.z;
    for (let i = 0; i < n; i++) {
      const bx = this.pts[i * 3] ?? ax, by = this.pts[i * 3 + 1] ?? ay, bz = this.pts[i * 3 + 2] ?? az;
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

  private writeStreak(n: number): void {
    const P = this.streakPos, pts = this.pts;
    if (n < 2) return;
    const cam = this.deps.camera;
    _o.setFromMatrixPosition(cam.matrixWorld);
    for (let i = 0; i < STREAK_PTS; i++) {
      const j = Math.min(i, n - 1), k = Math.min(j + 1, n - 1), h = Math.max(0, j - 1);
      const x = pts[j * 3] ?? 0, y = pts[j * 3 + 1] ?? 0, z = pts[j * 3 + 2] ?? 0;
      // the ribbon's side: across the path and the view (so it faces the camera)
      _a.set((pts[k * 3] ?? x) - (pts[h * 3] ?? x), (pts[k * 3 + 1] ?? y) - (pts[h * 3 + 1] ?? y), (pts[k * 3 + 2] ?? z) - (pts[h * 3 + 2] ?? z));
      _b.set(x - _o.x, y - _o.y, z - _o.z);
      _a.cross(_b).normalize().multiplyScalar(0.018 + 0.03 * (j / Math.max(1, n - 1)));
      P[i * 6] = x - _a.x; P[i * 6 + 1] = y - _a.y; P[i * 6 + 2] = z - _a.z;
      P[i * 6 + 3] = x + _a.x; P[i * 6 + 4] = y + _a.y; P[i * 6 + 5] = z + _a.z;
    }
    this.streakAttr.needsUpdate = true;
    this.streakT = 1.1; this.streak.visible = true;
  }

  update(dt: number): void {
    if (this.streakT > 0) {
      this.streakT -= dt;
      this.streakMat.uniforms.uAlpha.value = Math.max(0, this.streakT / 1.1) ** 1.5;
      if (this.streakT <= 0) this.streak.visible = false;
    }
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

/** the reward's display model: a Scythian recurve in gold, ibex heads at the limb tips, a string of light (≈ 1.2 m) */
export function goldenBowModel(sky: Sky): THREE.Object3D {
  const mat = painterlyMaterial(sky, { rim: 0.8, bands: 0.6, emissive: new THREE.Color(0.35, 0.2, 0.04) });
  const group = new THREE.Group();
  // the limbs: a recurve along a curve in the XY plane (grip at the origin, tips curling forward, +z = back of the bow)
  const half = (s: number) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, s * 0.18, 0.02), new THREE.Vector3(0, s * 0.36, 0.1), new THREE.Vector3(0, s * 0.5, 0.2),
    new THREE.Vector3(0, s * 0.58, 0.16), new THREE.Vector3(0, s * 0.62, 0.06),
  ]);
  const paintTube = (g: THREE.BufferGeometry, banded: boolean) => {
    const pos = g.getAttribute('position'), n = pos.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = Math.abs(pos.getY(i));
      const band = banded && (Math.abs(y - 0.12) < 0.02 || Math.abs(y - 0.3) < 0.018 || Math.abs(y - 0.46) < 0.016);
      _c.copy(band ? GOLD_HI : GOLD).lerp(GOLD_LO, banded ? 0.15 * Math.sin(y * 40) + 0.1 : 0);
      if (y < 0.07) _c.setRGB(0.18, 0.1, 0.05);             // the leather grip
      c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const tips: THREE.Vector3[] = [];
  for (const s of [1, -1]) {
    const curve = half(s);
    const tube = new THREE.TubeGeometry(curve, 40, 0.032, 8, false);
    // taper the tube toward the tip
    const pos = tube.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), t = Math.min(1, Math.abs(y) / 0.62), k = 1 - 0.5 * t;
      const cp = curve.getPoint(Math.min(1, t));
      pos.setX(i, cp.x + (pos.getX(i) - cp.x) * k); pos.setZ(i, cp.z + (pos.getZ(i) - cp.z) * k);
    }
    tube.computeVertexNormals();
    group.add(new THREE.Mesh(paintTube(tube, true), mat));
    const tip = curve.getPoint(1);
    tips.push(tip);
    // the ibex head: a muzzle and two swept-back horns
    const head = new THREE.SphereGeometry(0.035, 10, 8).scale(0.8, 1, 1.6).translate(tip.x, tip.y + s * 0.02, tip.z - 0.03);
    group.add(new THREE.Mesh(paintTube(head, false), mat));
    for (const hx of [-0.012, 0.012]) {
      const horn = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(tip.x + hx, tip.y + s * 0.03, tip.z - 0.01), new THREE.Vector3(tip.x + hx * 1.5, tip.y + s * 0.09, tip.z + 0.03),
        new THREE.Vector3(tip.x + hx * 2, tip.y + s * 0.11, tip.z + 0.1), new THREE.Vector3(tip.x + hx * 2, tip.y + s * 0.08, tip.z + 0.14),
      ]), 12, 0.007, 5, false);
      group.add(new THREE.Mesh(paintTube(horn, false), mat));
    }
  }
  // the string of light between the tips
  const a = tips[0], b = tips[1];
  if (a && b) {
    const len = a.distanceTo(b);
    const s = new THREE.CylinderGeometry(0.006, 0.006, len, 5);
    s.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const n = s.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = STRING_LIGHT.r; c[i * 3 + 1] = STRING_LIGHT.g; c[i * 3 + 2] = STRING_LIGHT.b; }
    s.setAttribute('color', new THREE.BufferAttribute(c, 3));
    group.add(new THREE.Mesh(s, mat));
  }
  group.traverse((o) => { if (isMesh(o)) { o.castShadow = false; o.receiveShadow = false; } });
  group.rotation.z = -0.5;
  const wrap = new THREE.Group(); wrap.add(group);
  return wrap;
}

export const GOLDEN_BOW = { ...BOW, id: 'weapon.golden-bow' as const,
  ui: { ...BOW.ui, name: 'Golden Bow', swapName: 'Golden Bow' }, meta: { ...BOW.meta, name: 'Golden Bow' } };
/** The Golden Bow as a row over the platform's reward bow: GOLDEN_BOW's row, its power applied once the replaced bow's
 *  multiplier, loose hook and saddle are carried over; the power keeps its preloaded streak clock. */
export const GoldenBow = rewardBowType(GOLDEN_BOW);
