import * as THREE from 'three';
import type { Sabre } from './Sabre';
import type { Player } from './Player';
import type { AnimalManager } from '../entities/AnimalManager';
import type { Animal } from '../entities/Animal';
import { heightAt } from '../world/Heightfield';
import { activePhysics } from '../physics/active';
import { castRay, floorBelow } from '../physics/query';
import { GroundTell } from '../game/Elite';
import { fxMaterial, FX, annulus, type FxMaterial } from '../world/nalati/KurganDungeon';
import { riding } from './riding';

/**
 * NAIZAGAI — the Storm Sabre of Jel Ata (Nalati row B14's reward; docs/design/nalati/elites-and-bosses.md "5 — Victory";
 * mockup art/nalati-grasslands/round-3/2-storm-titan/titan-5-victory-reward.png). Not a fork of the sabre: B3's `Sabre`
 * upgraded in place, the way `GoldenBow` upgrades the bow (`apply()` once the orb is taken, and at every boot after):
 *
 *   · the blade goes pale storm-blue steel with a cold glow (the steel extras material, recoloured);
 *   · MOUNTED at a full gallop (≥ 11 m/s), every slash throws a LIGHTNING CRESCENT 15 m forward along your look: 40 damage
 *     to the first creature in its path, then it ARCS to one more within 6 m;
 *   · ON FOOT, a full HEAVY (the charged swing) CALLS A BOLT where you look, within 25 m: a 0.6 s gold ring paints, then
 *     60 damage in 3 m;
 *   · in a steppe storm (`storm()`): +25 % damage and the crescent arcs twice.
 *
 *   const nz = new Naizagai({ scene, player, camera, animals, storm: () => weather.weather.stormActive, bolt });
 *   nz.apply(kit.sabre)          // idempotent
 *   game.onUpdate((dt, t) => nz.update(dt, t))
 *   naizagaiModel()              // the reward orb's display model
 *
 * Cost: the crescent is one annulus sector on the shared FX program, the arcs are `LightningStrip`s (MeshBasic, additive),
 * the call-down ring a `GroundTell` — no new shader programs beyond those the Titan fight already uses.
 */

export interface NaizagaiDeps {
  scene: THREE.Scene;
  player: Player;
  camera: THREE.Camera;
  animals: AnimalManager;
  /** a steppe storm is on (the weather's stormActive): +25 %, two arcs */
  storm: () => boolean;
  /** a sky-to-ground bolt at a point (the weather's WeatherFX.bolt) */
  bolt?: (x: number, y: number, z: number) => void;
}

const CRESCENT_RANGE = 15, CRESCENT_DMG = 40, CRESCENT_T = 0.32, ARC_R = 6, GALLOP_MIN = 11;
const CALL_RANGE = 25, CALL_DMG = 60, CALL_R = 3, CALL_T = 0.6;
const STORM_BLUE = new THREE.Color(0.62, 0.78, 1.0), STORM_GLOW = new THREE.Color(0.1, 0.2, 0.55);
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();

/**
 * A lightning bolt between two points: a jagged polyline drawn as two crossed ribbons (so it reads from every side),
 * additive HDR white-blue. `set(a, b)` re-jags it; `alpha` fades it. Shared with the Storm Titan (his spear, the arcs).
 */
export class LightningStrip {
  readonly mesh: THREE.Mesh;
  private readonly pos: Float32Array;
  private readonly attr: THREE.BufferAttribute;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly dir = new THREE.Vector3(); private readonly up = new THREE.Vector3();
  private readonly s1 = new THREE.Vector3(); private readonly s2 = new THREE.Vector3();
  constructor(scene: THREE.Object3D, private readonly n = 14, color: THREE.ColorRepresentation = new THREE.Color(1.6, 1.9, 3.2)) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((n + 1) * 4 * 3);
    this.attr = new THREE.BufferAttribute(this.pos, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    const idx: number[] = [];
    for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) { const k = r * (n + 1) * 2 + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    g.setAttribute('position', this.attr); g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.mat.name = 'nalati-lightning';
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 18;
    scene.add(this.mesh);
  }
  get alpha(): number { return this.mat.opacity; }
  set alpha(a: number) { this.mat.opacity = Math.max(0, Math.min(1, a)); this.mesh.visible = a > 0.01; }
  /** a new jagged path from a to b, `jag` m of sideways jitter, ribbons `width` m wide */
  set(a: THREE.Vector3, b: THREE.Vector3, jag: number, width: number): void {
    const n = this.n, P = this.pos, dir = this.dir;
    dir.subVectors(b, a); const L = dir.length() || 1; dir.multiplyScalar(1 / L);
    // two axes across the bolt (own temporaries: callers pass the module's _v / _w in)
    const ax = Math.abs(dir.y) < 0.9 ? this.up.set(0, 1, 0) : this.up.set(1, 0, 0);
    const s1 = this.s1.crossVectors(dir, ax).normalize(), s2 = this.s2.crossVectors(dir, s1).normalize();
    for (let i = 0; i <= n; i++) {
      const u = i / n, inner = i > 0 && i < n;
      const ox = inner ? (Math.random() - 0.5) * jag * 2 : 0, oy = inner ? (Math.random() - 0.5) * jag * 2 : 0;
      const cx = a.x + (b.x - a.x) * u + s1.x * ox + s2.x * oy, cy = a.y + (b.y - a.y) * u + s1.y * ox + s2.y * oy, cz = a.z + (b.z - a.z) * u + s1.z * ox + s2.z * oy;
      const w = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)));
      for (let r = 0; r < 2; r++) {
        const s = r === 0 ? s1 : s2, k = (r * (n + 1) * 2 + i * 2) * 3;
        P[k] = cx - s.x * w; P[k + 1] = cy - s.y * w; P[k + 2] = cz - s.z * w;
        P[k + 3] = cx + s.x * w; P[k + 4] = cy + s.y * w; P[k + 5] = cz + s.z * w;
      }
    }
    this.attr.needsUpdate = true;
  }
}

/** the display model in the reward orb: the blade point-down, pale steel with a white fork damascus, a gold guard */
export function naizagaiModel(): THREE.Object3D {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: STORM_BLUE, emissive: STORM_GLOW, emissiveIntensity: 1.2, metalness: 0.85, roughness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c25a, metalness: 0.9, roughness: 0.3 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x3a2216, roughness: 0.8 });
  // a curved blade: a lofted strip bent along an arc
  const seg = 16, P: number[] = [], I: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, y = -0.85 * u, x = 0.12 * u * u, w = 0.045 * (1 - 0.75 * u ** 3);
    P.push(x - w, y, 0, x + w * 0.6, y, 0.012, x + w * 0.6, y, -0.012);
    if (i < seg) { const k = i * 3; I.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k, k + 2, k + 3, k + 2, k + 5, k + 3, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setIndex(I); bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, steel));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.05), gold); guard.position.y = 0.01; g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 8), grip); hilt.position.y = 0.1; g.add(hilt);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), gold); pom.position.y = 0.19; g.add(pom);
  g.position.y = 0.35;
  const root = new THREE.Group(); root.add(g);
  return root;
}

export class Naizagai {
  private sabre: Sabre | null = null;
  private wasSwinging = false;
  private readonly crescent: THREE.Mesh;
  private readonly crescentMat: FxMaterial;
  private crescentT = -1;
  private readonly crescentFrom = new THREE.Vector3();
  private readonly crescentDir = new THREE.Vector3();
  private readonly arcs: LightningStrip[];
  private arcT = 0;
  private readonly ring: GroundTell;
  private readonly callAt = new THREE.Vector3();
  private callT = -1;

  constructor(private readonly deps: NaizagaiDeps) {
    this.crescentMat = fxMaterial(FX.ring, new THREE.Color(1.3, 1.7, 3.0), 0);
    this.crescentMat.uniforms.uP.value.x = 1.4;
    const g = annulus(1.3, 2.5, 28, Math.PI * 0.7);
    g.rotateY(Math.PI / 2 - Math.PI * 0.35);   // the arc bows forward (−z) around the flight line
    this.crescent = new THREE.Mesh(g, this.crescentMat);
    this.crescent.frustumCulled = false; this.crescent.visible = false; this.crescent.renderOrder = 17;
    deps.scene.add(this.crescent);
    this.arcs = [new LightningStrip(deps.scene, 10), new LightningStrip(deps.scene, 10)];
    this.ring = new GroundTell(deps.scene, 'ring', new THREE.Color(2.2, 1.7, 0.6));
  }

  get applied(): boolean { return this.sabre !== null; }

  /** the upgrade (idempotent): the blade recoloured storm-blue; the moves hook in through update() */
  apply(sabre: Sabre): void {
    if (this.sabre === sabre) return;
    this.sabre = sabre;
    sabre.model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats: readonly unknown[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m instanceof THREE.MeshStandardMaterial) { m.color.copy(STORM_BLUE); m.emissive.copy(STORM_GLOW); m.emissiveIntensity = 1; }
    });
  }

  update(dt: number, t: number): void {
    const sb = this.sabre;
    this.ring.setTime(t);
    if (sb !== null) {
      const sw = sb.swinging;
      if (sw && !this.wasSwinging) {
        const m = sb.mount;
        if (m !== null && m.speed >= GALLOP_MIN) this.throwCrescent();
        else if (m === null && sb.heavySwing) this.callBolt();
      }
      this.wasSwinging = sw;
    }
    // the crescent flies
    if (this.crescentT >= 0) {
      this.crescentT += dt;
      const u = Math.min(1, this.crescentT / CRESCENT_T);
      this.crescent.position.copy(this.crescentFrom).addScaledVector(this.crescentDir, 1.2 + u * (CRESCENT_RANGE - 1.2));
      this.crescentMat.uniforms.uAlpha.value = (1 - u * u) * 1.2;
      this.crescentMat.uniforms.uTime.value = t;
      if (u >= 1) { this.crescentT = -1; this.crescent.visible = false; }
    }
    if (this.arcT > 0) { this.arcT -= dt; for (const a of this.arcs) a.alpha = Math.min(a.alpha, this.arcT / 0.25); }
    // the call-down
    if (this.callT >= 0) {
      this.callT += dt;
      this.ring.ring(this.callAt.x, this.callAt.z, CALL_R, 0.9 * (0.6 + 0.4 * Math.sin(this.callT * 30)));
      if (this.callT >= CALL_T) {
        this.callT = -1; this.ring.hide();
        this.deps.bolt?.(this.callAt.x, this.callAt.y, this.callAt.z);
        const dmg = Math.round(CALL_DMG * this.mul());
        for (const a of this.deps.animals.animals) {
          if (!this.hittable(a) || Math.hypot(a.position.x - this.callAt.x, a.position.z - this.callAt.z) > CALL_R + 0.6 * a.scale) continue;
          _d.set(a.position.x - this.callAt.x, 0.5, a.position.z - this.callAt.z).normalize();
          a.headWorld(_v);
          a.applyDamage(dmg, _v, _d);
        }
      }
    }
  }

  private mul(): number { return this.deps.storm() ? 1.25 : 1; }
  private hittable(a: Animal): boolean { return a.alive && !a.hidden && a !== riding.horse && a.mem['owned'] !== 1; }

  /** mounted, at a gallop: the crescent 15 m along the look, the first creature in its path, then the arcs */
  private throwCrescent(): void {
    const cam = this.deps.camera;
    cam.getWorldPosition(_o); cam.getWorldDirection(_d);
    _d.y = Math.max(-0.25, Math.min(0.25, _d.y)); _d.normalize();
    this.crescentFrom.copy(_o).y -= 0.35;
    this.crescentDir.copy(_d);
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _d);
    this.crescent.quaternion.copy(_q);
    this.crescent.position.copy(this.crescentFrom);
    this.crescent.visible = true; this.crescentT = 0;
    // the path: a capsule 15 m long, 2.6 m wide
    let best: Animal | null = null, bd = Infinity;
    for (const a of this.deps.animals.animals) {
      if (!this.hittable(a)) continue;
      _v.set(a.position.x, a.position.y + a.dims.bodyY * a.scale, a.position.z).sub(this.crescentFrom);
      const along = _v.dot(_d);
      if (along < 0.5 || along > CRESCENT_RANGE) continue;
      const side = _w.copy(_d).multiplyScalar(along).sub(_v).length();
      if (side > 2.6 + a.dims.bodyRadius * a.scale || along >= bd) continue;
      bd = along; best = a;
    }
    if (best === null) return;
    const dmg = Math.round(CRESCENT_DMG * this.mul());
    const hitA = best;
    hitA.headWorld(_v);
    hitA.applyDamage(dmg, _v, _d);
    // the arcs: to the nearest other creature within 6 m, then (in a storm) on from that one
    const arcs = this.deps.storm() ? 2 : 1;
    let from: Animal = hitA;
    const done = new Set<Animal>([hitA]);
    for (let i = 0; i < arcs; i++) {
      let next: Animal | null = null, nd = ARC_R;
      for (const a of this.deps.animals.animals) {
        if (done.has(a) || !this.hittable(a)) continue;
        const d = a.position.distanceTo(from.position);
        if (d < nd) { nd = d; next = a; }
      }
      if (next === null) break;
      from.headWorld(_o); next.headWorld(_v);
      const arc = this.arcs[i];
      if (arc) { arc.set(_o, _v, 0.45, 0.09); arc.alpha = 1; this.arcT = 0.35; }
      _w.subVectors(_v, _o).normalize();
      next.applyDamage(dmg, _v, _w);
      done.add(next); from = next;
    }
  }

  /** on foot, a full heavy: the first surface along the look within 25 m (NALATI-MERGE P2: a ray through the physics
   *  world — terrain, rocks, decks, yurts), a ring on the floor there, then the bolt */
  private callBolt(): void {
    const cam = this.deps.camera;
    cam.getWorldPosition(_o); cam.getWorldDirection(_d);
    const ph = activePhysics();
    const hit = ph ? castRay(ph, _o, _d, CALL_RANGE) : null;
    if (hit) _v.set(hit.point.x, hit.point.y, hit.point.z);
    else _v.copy(_o).addScaledVector(_w.set(_d.x, 0, _d.z).normalize(), CALL_RANGE);
    // the ring lies on the floor under that point: a deck, a rock top, else the terrain
    this.callAt.set(_v.x, (ph ? floorBelow(ph, _v.x, _v.z, _v.y + 0.5, 80) : undefined) ?? heightAt(_v.x, _v.z), _v.z);
    this.callT = 0;
  }
}
