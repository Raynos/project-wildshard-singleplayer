/**
 * Zipline — the traversal reward (DRIFTWOOD-REMASTER A7): a plank launch deck jutting out over the headland's
 * cliff a short walk down from the lookout, a steel cable sagging 50-odd metres down to a padded post on the Wreck
 * Cove beach beside the sea cave, and a pulley trolley with a T-bar you hang from. "[E] Ride the zipline" and you
 * go: gravity along the cable minus drag (12–16 m/s at the bottom), the trolley sings along the wire, you let go
 * on the sand with the last of the speed. Built with the low-poly kit (LowPolyKit + lowPolyMaterial): two draws —
 * the deck + posts + cable + landing (one merged mesh) and the trolley.
 *
 *   const zip = new Zipline(sky, { top, bottom }).build();       // top = the deck's outer edge (floor), bottom = the landing (floor)
 *   scene.add(zip.group); player.platforms.push((x, z) => zip.floorHeightAt(x, z)); prompts.push(zip.prompt);
 *   game.onUpdate((dt) => zip.update(dt, player));                // after player.update: while riding it owns the position
 *   zip.onRide = (on) => …                                        // lower the viewmodel, sound, achievement
 *
 * Why not straight off the lookout platform (the model's `zipTop`): the headland's top is a flat 34 m shelf for 30 m
 * before its cliff; any cable from the platform down to the cove passes 10 m under that shelf. The deck sits at the
 * cliff lip on the line from the platform to the cave, so it still reads as the lookout's zipline.
 */
import * as THREE from 'three';
import { LowPolyKit, log, beam, plank, rope, rock, lowPolyMaterial } from './lowpolyKit';
import type { Sky } from './Sky';
import type { Interactable } from './Cabin';
import type { ColliderDesc } from './registry';

export interface ZiplineSpec { top: THREE.Vector3; bottom: THREE.Vector3; /** sag in metres at mid-span per 100 m (default 1.6) */ sag?: number }

const C = { wood: '#8a6440', woodDark: '#5f432a', woodLight: '#a88157', steel: '#3c4046', rope: '#b9a57a', pad: '#c9b27c', straw: '#d8c07a', red: '#a83a2a' };
const DECK_H = 0.5, CABLE_ABOVE = 3.6, HANG = 2.9, LANDING_ABOVE = 3.2;   // the eye rides ~1.2 m under the wire, below the T-bar: the trolley stays out of the view
const G = 9.8, DRAG = 0.012, VMAX = 16;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const _p = new THREE.Vector3();

export class Zipline {
  readonly group = new THREE.Group();
  readonly prompt: Interactable;
  onRide?: (on: boolean) => void;
  /** the cable's two ends (world) */
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();
  private trolley!: THREE.Mesh;
  private riding = false;
  private s = 0; private v = 0;
  private len = 0; private sag = 0;
  private dir = new THREE.Vector3();
  private deck = { x: 0, z: 0, yaw: 0, y: 0, hw: 1.2, hd: 1.8 };

  constructor(private sky: Sky, private spec: ZiplineSpec) {
    const flat = V(spec.bottom.x - spec.top.x, 0, spec.bottom.z - spec.top.z).normalize();
    // the deck: 3.6 m long, its outer edge at `top`, running back up the slope
    this.deck.yaw = Math.atan2(flat.x, flat.z);
    this.deck.x = spec.top.x - flat.x * this.deck.hd; this.deck.z = spec.top.z - flat.z * this.deck.hd; this.deck.y = spec.top.y + DECK_H;
    this.a.set(spec.top.x + flat.x * 0.4, this.deck.y + CABLE_ABOVE, spec.top.z + flat.z * 0.4);
    this.b.set(spec.bottom.x, spec.bottom.y + LANDING_ABOVE, spec.bottom.z);
    this.len = this.a.distanceTo(this.b);
    this.sag = (spec.sag ?? 1.6) * (this.len / 100);
    this.dir.subVectors(this.b, this.a).normalize();
    const promptAt = V(this.a.x - flat.x * 0.6, this.deck.y + 1.0, this.a.z - flat.z * 0.6), riding = () => this.riding;
    this.prompt = {
      position: promptAt,
      get radius() { return riding() ? 0 : 2.4; },
      label: 'Ride the zipline',
      onInteract: () => { this.start(); },
    };
  }

  /** a point on the cable at arc position s (0 … len), sagging as a parabola */
  at(s: number, out: THREE.Vector3): THREE.Vector3 {
    const t = THREE.MathUtils.clamp(s / this.len, 0, 1);
    return out.lerpVectors(this.a, this.b, t).setY(this.a.y + (this.b.y - this.a.y) * t - this.sag * 4 * t * (1 - t));
  }

  build(): this {
    const k = new LowPolyKit(0x21e);
    const d = this.deck, cs = Math.cos(d.yaw), sn = Math.sin(d.yaw);
    const W = (lx: number, ly: number, lz: number) => V(d.x + lx * cs + lz * sn, ly, d.z - lx * sn + lz * cs);
    const m = new THREE.Matrix4();
    // the deck: planks across, two stringers, four posts down to the rock, a rail at the back
    for (let i = 0; i < 12; i++) {
      const lz = -d.hd + 0.15 + i * 0.3;
      k.add(plank(d.hw * 2, 0.28, 0.06, k.rng, 0.012), i % 2 ? C.wood : C.woodLight, { matrix: m.compose(W(0, d.y - 0.03, lz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(1, 1, 1)) });
    }
    for (const sx of [-1, 1]) {
      k.add(beam(W(sx * (d.hw - 0.1), d.y - 0.12, -d.hd), W(sx * (d.hw - 0.1), d.y - 0.12, d.hd), 0.12, 0.16), C.woodDark);
      for (const sz of [-1, 1]) { const p = W(sx * (d.hw - 0.12), 0, sz * (d.hd - 0.15)); k.add(log(V(p.x, d.y - 3.5, p.z), V(p.x, d.y + (sz < 0 ? 1.0 : 0), p.z), 0.1, 0.09, 6), C.woodDark); }
    }
    k.add(beam(W(-d.hw, d.y + 0.95, -d.hd + 0.15), W(d.hw, d.y + 0.95, -d.hd + 0.15), 0.08, 0.1), C.wood);
    // the launch A-frame at the outer edge: two legs, a cross beam, the cable anchor block
    for (const sx of [-1, 1]) k.add(log(W(sx * (d.hw - 0.2), d.y, d.hd - 0.1), V(this.a.x + sx * 0.12 * cs, this.a.y + 0.35, this.a.z - sx * 0.12 * sn), 0.09, 0.07, 6), C.woodDark);
    k.add(beam(V(this.a.x - 0.5 * cs, this.a.y + 0.3, this.a.z + 0.5 * sn), V(this.a.x + 0.5 * cs, this.a.y + 0.3, this.a.z - 0.5 * sn), 0.14, 0.14), C.wood);
    k.add(new THREE.BoxGeometry(0.22, 0.22, 0.22), C.steel, { matrix: m.makeTranslation(this.a.x, this.a.y + 0.05, this.a.z) });
    k.add(new THREE.BoxGeometry(0.5, 0.3, 0.06), C.red, { matrix: m.compose(W(0, d.y + 1.25, -d.hd + 0.15), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(1, 1, 1)) });   // a red flag board
    // the cable: 40 sagging segments
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) pts.push(this.at((i / 40) * this.len, V(0, 0, 0)));
    k.add(rope(pts, 0.022, 4), C.steel, { jitter: 0.02 });
    // the landing: a stout post the cable ends on, a padded stop board, a straw pile to land in
    const b = this.b, bg = this.spec.bottom.y;
    k.add(log(V(b.x + this.dir.x * 0.5, bg - 0.6, b.z + this.dir.z * 0.5), V(b.x + this.dir.x * 0.5, b.y + 0.5, b.z + this.dir.z * 0.5), 0.14, 0.12, 7), C.woodDark);
    k.add(new THREE.BoxGeometry(0.9, 0.9, 0.2), C.pad, { matrix: m.compose(V(b.x + this.dir.x * 0.3, bg + 1.4, b.z + this.dir.z * 0.3), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(1, 1, 1)) });
    for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; k.add(rock(0.55, 0, k.rng, 0.45, 0.35), C.straw, { matrix: m.makeTranslation(b.x - this.dir.x * 1.2 + Math.cos(ang) * 0.9, bg + 0.08, b.z - this.dir.z * 1.2 + Math.sin(ang) * 0.9), jitter: 0.12 }); }
    const mat = lowPolyMaterial(this.sky);
    const mesh = new THREE.Mesh(k.finish({ ao: false }), mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'zipline';
    // the trolley: a pulley housing on the wire, two straps, a T-bar (origin = on the cable)
    const t = new LowPolyKit(0x21f);
    t.add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10).rotateX(Math.PI / 2), C.steel);
    t.add(new THREE.BoxGeometry(0.08, 0.26, 0.22), C.red, { matrix: m.makeTranslation(0, -0.08, 0) });
    for (const sx of [-1, 1]) t.add(log(V(0, -0.18, 0), V(sx * 0.28, -0.72, 0), 0.018, 0.018, 4), C.rope);
    t.add(log(V(-0.34, -0.74, 0), V(0.34, -0.74, 0), 0.03, 0.03, 6), C.woodDark);
    this.trolley = new THREE.Mesh(t.finish({ ao: false }), mat);
    this.trolley.castShadow = true;
    this.parkTrolley();
    this.group.add(mesh, this.trolley);
    return this;
  }

  /** the deck is walkable */
  floorHeightAt(x: number, z: number): number | undefined {
    const d = this.deck, dx = x - d.x, dz = z - d.z, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) <= d.hw && Math.abs(lz) <= d.hd ? d.y : undefined;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — every floor `floorHeightAt` describes, as real
   * geometry (it has no legacy boxes). src/physics/pieces.ts turns it into Rapier colliders. The launch deck: a 0.2 m
   * slab, its top the deck floor, its footprint the deck's. The deck stands 0.37–0.85 m off the rock (DECK_H); the old
   * 0.5 m step-up climbed it only on its +x side (0.37–0.47 m, the side toward the lookout path; the back has the rail,
   * the front is the cliff), so that side gets one tread 0.24 m under the deck, 0.45 m deep, down into the rock.
   */
  colliderDescs(): ColliderDesc[] {
    const d = this.deck, hy = 0.1, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const step = 0.24, depth = 0.45, lx = d.hw + depth / 2, bottom = d.y - 1.6, th = (d.y - step - bottom) / 2;
    return [
      { kind: 'box', x: d.x, y: d.y - hy, z: d.z, hx: d.hw, hy, hz: d.hd, yaw: d.yaw },
      { kind: 'box', x: d.x + lx * c, y: bottom + th, z: d.z - lx * s, hx: depth / 2, hy: th, hz: d.hd, yaw: d.yaw },
    ];
  }

  get isRiding(): boolean { return this.riding; }

  start(): void {
    if (this.riding) return;
    this.riding = true; this.s = 0.4; this.v = 2.5;
    this.onRide?.(true);
  }

  private parkTrolley(): void {
    this.at(0.6, this.trolley.position);
    this.trolley.rotation.set(0, Math.atan2(this.dir.x, this.dir.z) + Math.PI / 2, 0);
  }

  /** after player.update: while riding, the cable owns the player's position */
  update(dt: number, player: { position: THREE.Vector3; velocity: THREE.Vector3 }): void {
    if (!this.riding) return;
    const slope = -(this.at(this.s + 0.5, _p).y - this.at(this.s, this.trolley.position).y) / 0.5;   // + = downhill
    this.v = Math.min(VMAX, Math.max(1.5, this.v + (G * slope * 0.9 - DRAG * this.v * this.v) * dt));
    this.s += this.v * dt;
    this.at(this.s, this.trolley.position);
    this.trolley.rotation.z = Math.sin(this.s * 0.7) * 0.05;
    player.position.copy(this.trolley.position); player.position.y -= HANG;
    player.velocity.set(0, 0, 0);
    if (this.s >= this.len - 1.6) {
      // let go: the last of the speed carries you into the straw
      this.riding = false;
      player.velocity.set(this.dir.x * Math.min(6, this.v * 0.4), 1.5, this.dir.z * Math.min(6, this.v * 0.4));
      this.parkTrolley();
      this.onRide?.(false);
    }
  }
}
