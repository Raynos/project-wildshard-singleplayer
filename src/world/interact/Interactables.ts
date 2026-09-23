/**
 * Interactables — the runtime of the interactables kit (A2): builds every row of an `InteractTable` (types.ts) into TWO
 * BatchedMeshes for the whole shard (lit parts on the shared `lowPolyMaterial`, glowing parts unlit — 2 draw calls,
 * per-instance frustum culling), wires one E-prompt per row into the game's interactable list, adds colliders, and
 * runs the behaviour: lids and doors swing, levers throw, plates sink under you or a barrel (an overlap query of the
 * PLAYER / ITEM groups), the barrel is a dynamic body your capsule pushes (PHYSICS P7-L1: it tips, rolls, stops at
 * walls; `BarrelWatch` sends it home when it is lost or wedged), pickups bob and are taken, the beacon burns. All state
 * lives in `Flags` (flags.ts), so a quest, a save and a validator see the same thing.
 *
 *   const kit = new Interactables({ scene, sky, player, flags, place, floorAt, prompts: interactables }).build(table);
 *   kit.onEvent = (e) => { … toast / audio / inventory … };          // see InteractEvent
 *   game.onUpdate((dt, t) => kit.update(dt, t));
 *   kit.moveTo('hold-key', x, z)                                      // a key dropped where the sailor fell
 *   kit.live('hold-grate')?.position                                  // world position of a row
 *
 * No point lights (plan row 0.3: lights are never added / removed mid-play); glow is emissive-looking unlit colour that
 * blooms, pulsed through the per-instance colour.
 */
import * as THREE from 'three';
import { lowPolyMaterial } from '../lowpolyKit';
import type { Sky } from '../Sky';
import type { Collider } from '../../player/Player';
import type { Interactable } from '../Cabin';
import type { Physics } from '../../physics/Physics';
import type { GroupName } from '../../physics/groups';
import { activePhysics } from '../../physics/active';
import { castSegment, lineOfSight } from '../../physics/query';
import { activeBodies, overlapBox, type Body, type BodySpec } from '../../physics/bodies';
import { waterLevel } from '../Heightfield';
import { test, type Flags } from './flags';
import { autoFlag, type InteractDef, type InteractTable, type Place } from './types';
import * as Mdl from './models';

export interface InteractEvent {
  type: 'open' | 'locked' | 'take' | 'lever' | 'door' | 'press' | 'release' | 'light' | 'sit' | 'use' | 'loot' | 'barrel-reset';
  def: InteractDef;
  /** a human line for the toast */
  text?: string;
  /** an inventory item handed out (loot / pickup) */
  item?: string;
  n?: number;
  /** a flag handed out as loot (a chest's `{ flag }` — the wreck's glyph shard) */
  flag?: string;
  /** world position of the row */
  at: THREE.Vector3;
}

export interface InteractHost {
  scene: THREE.Scene;
  sky: Sky;
  player: { position: THREE.Vector3; velocity: THREE.Vector3; colliders: Collider[] };
  flags: Flags;
  /** a placement → world point (y = the floor there unless pinned) + world yaw */
  place: (p: Place) => { x: number; y: number; z: number; yaw: number };
  /** walkable floor height at (x, z): the highest platform, else the terrain */
  floorAt: (x: number, z: number) => number;
  /** the game's interactable list (main.ts scans it for the nearest "[E] …" prompt) */
  prompts: Interactable[];
}

type BatchId = 'lit' | 'glow';
interface Part {
  batch: BatchId; inst: number;
  /** local pose in the row frame (called when the row is dirty) */
  pose: (lv: Live, t: number, out: THREE.Matrix4) => void;
  /** only drawn while this holds (default: while the row is shown) */
  when?: (lv: Live) => boolean;
  /** glow parts: brightness (per-instance colour) */
  glow?: (lv: Live, t: number) => number;
  animated: boolean;
}

export class Live {
  readonly position = new THREE.Vector3();
  yaw = 0;
  shown = true;
  /** 0 closed / off / up … 1 open / on / pressed — eased toward `target` */
  anim = 0;
  target = 0;
  parts: Part[] = [];
  collider: Collider | null = null;
  prompt: Interactable | null = null;
  dirty = true;
  /** barrel: its start (the leash is measured from here) */
  home = new THREE.Vector3();
  /** barrel: its full turn (PHYSICS P7-L1: it tips and rolls), `position` being its base centre under that turn */
  readonly rot = new THREE.Quaternion();
  /** barrel: its dynamic body (PHYSICS P7); null without a physics world (node tests) */
  body: Body | null = null;
  /** barrel: when it has to go home (lost, wedged, past its leash) */
  watch: BarrelWatch | null = null;
  /** glow tint (pickups' `color`) */
  tint = new THREE.Color(1, 1, 1);
  constructor(readonly def: InteractDef) {}
}

const PROMPT_R = 2.5, TOUCH_R = 1.1, BARREL_R = 0.38, BARREL_HALF = 0.475, PLAYER_R = 0.35;
/**
 * The puzzle barrel's body (PHYSICS P7-L1): a free cylinder, ~110 kg, never culled. It starts upright; the player's 80 kg
 * capsule walking into it tips it (grippy wood on sand: it tips before it slides), and on its side it rolls — across
 * the push, or down a slope steeper than ~3.5° (its rolling resistance, packed sand's); along its length it is shoved.
 */
export const BARREL_BODY = {
  shape: { cylinder: { radius: BARREL_R, halfHeight: BARREL_HALF } }, material: 'wood', density: 250, friction: 1.0,
  angularDamping: 0.2, rolling: 0.06, keep: true,
} as const satisfies Omit<BodySpec, 'owner'>;
/** a plate feels what overlaps a slab this far inside its rim and this deep over it (feet, a barrel's base) */
const PLATE_INSET = 0.1, PLATE_DEPTH = 0.1;
const _m = new THREE.Matrix4(), _local = new THREE.Matrix4(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3(), _e = new THREE.Euler();
const OFF: Collider = { x: 0, z: 0, hw: 0, hd: 0, rot: 0, yTop: -1e6, yBottom: -1e6 + 1 };
const _chest = new THREE.Vector3(), _bp = { x: 0, y: 0, z: 0 }, _bq = { x: 0, y: 0, z: 0, w: 1 };
const PARKED = { yTop: -1e6, yBottom: -1e6 - 1 };
const parked = (c: Collider): boolean => c.yTop < -1e5;

// ── line of sight (PHYSICS P5): a prompt is offered only when the eye can SEE it ─────────────────────────────────────

/**
 * How the LOS pick sees one prompt. `slack`: a world hit this many metres short of the prompt point still counts as
 * seen (the thing's own body — its half-size + 0.2). `body`: the Collider box that IS the thing (the physics bridge
 * tags its mirror with it as owner), so a ray that meets it first has met the target, not a wall.
 */
export interface Sight { slack: number; body?: Collider | null }
/** the slack of a prompt nobody described (a pickup orb, an NPC's head, a zipline platform) */
export const SIGHT_SLACK = 0.5;
const sights = new WeakMap<Interactable, Sight>();
export function setSight(it: Interactable, s: Sight): void { sights.set(it, s); }

/** Does `eye` see the prompt? — no world surface between them but its own body. No physics world (boot, node) → yes. */
export function canSee(physics: Physics | null, eye: { x: number; y: number; z: number }, it: Interactable): boolean {
  if (!physics) return true;
  const s = sights.get(it);
  if (lineOfSight(physics, eye, it.position, s?.slack ?? SIGHT_SLACK)) return true;
  const body = s?.body;
  return body !== undefined && body !== null && castSegment(physics, eye, it.position)?.owner === body;
}

/** The nearest prompt within its own radius of `eye` that `eye` can see (main.ts's "[E] …" pick, and so the E key). */
export function pickInteractable<T extends Interactable>(list: readonly T[], eye: THREE.Vector3, physics: Physics | null): T | undefined {
  let best = Infinity, pick: T | undefined;
  for (const it of list) {
    const d = it.position.distanceTo(eye);
    if (d < it.radius && d < best && canSee(physics, eye, it)) { best = d; pick = it; }
  }
  return pick;
}

const T = (x: number, y: number, z: number, out: THREE.Matrix4, rx = 0, ry = 0, rz = 0, s = 1): void => {
  out.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.setScalar(s));
};

// ── the barrel never jams the puzzle (PHYSICS P7-L1) ─────────────────────────────────────────────────────────────────

interface V3 { x: number; y: number; z: number }
export interface BarrelEnv {
  /** feet and the velocity the player is asking for (Player.velocity: what the input wants, even against a wall) */
  player: { position: V3; velocity: V3 };
  /** walkable floor height at (x, z): the highest platform, else the ground (the sea floor offshore) */
  floorAt: (x: number, z: number) => number;
  /** the still water level (the sea; a pond) */
  water: () => number;
  /** is (the barrel's centre) on or at a plate? — it is never sent home from there */
  onPlate: (c: V3) => boolean;
}

/** lost: offshore (the ground under it this far under the water line), or this far under the floor (through the world) */
export const BARREL_SEA_DEPTH = 0.3, BARREL_UNDER = 1.5;
/** …for this long (s) */
export const BARREL_LOST_T = 4;
/** wedged: the player walks into it (within PUSH_R of its centre, asking ≥ PUSH_SPEED m/s at it) for this long (s) and
 *  it ends up less than WEDGE_MOVE m from where it was */
export const BARREL_WEDGE_T = 4;
const PUSH_R = BARREL_R + PLAYER_R + 0.4, PUSH_SPEED = 1, WEDGE_MOVE = 0.6, HOME_R = 1, PLATE_NEAR = 0.3;

/**
 * When the puzzle barrel has to go home (PHYSICS P7-L1: it rolls now, so it can end up somewhere the puzzle can't use
 * it). `check` is called every frame with the body's centre and answers true when it must go, now:
 *   - past its leash (as before), at once;
 *   - lost — offshore, or under the world — for BARREL_LOST_T;
 *   - wedged — the player has been walking into it for BARREL_WEDGE_T and it got no further than WEDGE_MOVE (jammed in
 *     rocks, against a wall, on its end in a corner).
 * Never while it is at a plate (the puzzle is being solved) or at home (nothing to fix).
 */
export class BarrelWatch {
  lost = 0;
  wedge = 0;
  private readonly from = { x: 0, y: 0, z: 0 };

  constructor(readonly home: V3, readonly leash: number) {}

  check(c: V3, dt: number, env: BarrelEnv): boolean {
    const h = this.home, dx = c.x - h.x, dz = c.z - h.z, dy = c.y - BARREL_HALF - h.y;
    if (dx * dx + dy * dy + dz * dz > this.leash * this.leash) return true;
    if (dx * dx + dz * dz < HOME_R * HOME_R || env.onPlate(c)) { this.clear(); return false; }
    const floor = env.floorAt(c.x, c.z);
    this.lost = floor < env.water() - BARREL_SEA_DEPTH || c.y < floor - BARREL_UNDER ? this.lost + dt : 0;
    const p = env.player.position, v = env.player.velocity;
    const px = c.x - p.x, pz = c.z - p.z, pd = Math.hypot(px, pz);
    const into = pd < PUSH_R && pd > 1e-3 && Math.abs(c.y - p.y) < 1.5 && (v.x * px + v.z * pz) / pd > PUSH_SPEED;
    if (into) {
      if (this.wedge === 0) { this.from.x = c.x; this.from.y = c.y; this.from.z = c.z; }
      this.wedge += dt;
      if (this.wedge >= BARREL_WEDGE_T) {
        // a window of pushing: judged by where it got to, not by the jostling on the way (a pinned barrel rattles)
        if (Math.hypot(c.x - this.from.x, c.y - this.from.y, c.z - this.from.z) < WEDGE_MOVE) return true;
        this.wedge = 0;
      }
    } else this.wedge = Math.max(0, this.wedge - dt);
    return this.lost > BARREL_LOST_T;
  }

  clear(): void { this.lost = 0; this.wedge = 0; }
}

export class Interactables {
  onEvent?: (e: InteractEvent) => void;
  /** a bench was sat on: its world position and facing (the host turns the player to the view) */
  onSit?: (at: THREE.Vector3, yaw: number) => void;
  readonly lives: Live[] = [];
  private byId = new Map<string, Live>();
  private batches!: Record<BatchId, THREE.BatchedMesh>;
  private geoIds = new Map<string, { batch: BatchId; id: number }>();
  private pending: { key: string; batch: BatchId; geo: THREE.BufferGeometry }[] = [];
  private instCount: Record<BatchId, number> = { lit: 0, glow: 0 };
  private seed = 0x1a7e;
  private unsub: (() => void) | null = null;

  constructor(private host: InteractHost) {}

  live(id: string): Live | undefined { return this.byId.get(id); }

  build(table: InteractTable): this {
    // pass 1: geometries (cached by shape) + the parts list per row
    for (const def of table.rows) {
      const lv = new Live(def);
      this.lives.push(lv); this.byId.set(def.id, lv);
      this.parts(lv);
    }
    // pass 2: the two batches sized to fit, then instances
    const size = (b: BatchId) => this.pending.filter((p) => p.batch === b).reduce((a, p) => a + p.geo.getAttribute('position').count, 0);
    const litMat = lowPolyMaterial(this.host.sky);
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: true });
    glowMat.name = 'interact-glow';
    this.batches = {
      lit: new THREE.BatchedMesh(Math.max(1, this.instCount.lit), Math.max(3, size('lit')), Math.max(3, size('lit')), litMat),
      glow: new THREE.BatchedMesh(Math.max(1, this.instCount.glow), Math.max(3, size('glow')), Math.max(3, size('glow')), glowMat),
    };
    for (const [b, bm] of Object.entries(this.batches) as [BatchId, THREE.BatchedMesh][]) {
      bm.name = `interact-${b}`; bm.sortObjects = false; bm.perObjectFrustumCulled = true; bm.frustumCulled = false; // the batch's own sphere is stale (instances move); three culls each instance instead
      bm.castShadow = b === 'lit'; bm.receiveShadow = b === 'lit';
    }
    for (const p of this.pending) this.geoIds.set(p.key, { batch: p.batch, id: this.batches[p.batch].addGeometry(p.geo) });
    for (const p of this.pending) p.geo.dispose();
    this.pending = [];
    for (const lv of this.lives) for (const part of lv.parts) {
      const key = (part as Part & { geoKey: string }).geoKey;
      const g = this.geoIds.get(key);
      if (!g) throw new Error(`interact: no geometry ${key}`);
      part.inst = this.batches[g.batch].addInstance(g.id);
      this.batches[g.batch].setColorAt(part.inst, _c.setRGB(1, 1, 1));
    }
    this.host.scene.add(this.batches.lit, this.batches.glow);
    for (const lv of this.lives) this.placeLive(lv);
    this.unsub = this.host.flags.onChange(() => this.refresh());
    this.refresh(true);
    return this;
  }

  dispose(): void {
    this.unsub?.();
    for (const bm of Object.values(this.batches)) { this.host.scene.remove(bm); bm.dispose(); }
    for (const lv of this.lives) { if (lv.prompt) { const i = this.host.prompts.indexOf(lv.prompt); if (i !== -1) this.host.prompts.splice(i, 1); } if (lv.collider) Object.assign(lv.collider, OFF); if (lv.body) { activeBodies()?.remove(lv.body); lv.body = null; } }
  }

  /** move a row to world (x, z) on the floor there (a key dropped by an enemy) */
  moveTo(id: string, x: number, z: number, y?: number): void {
    const lv = this.byId.get(id); if (!lv) return;
    lv.position.set(x, y ?? this.host.floorAt(x, z), z);
    lv.home.copy(lv.position);
    if (lv.body) this.sendHome(lv, lv.body); // its watch reads `home` live
    this.updateCollider(lv); lv.dirty = true;
  }

  // ── build ──────────────────────────────────────────────────────────────────────────────────────

  private geo(key: string, batch: BatchId, make: () => THREE.BufferGeometry): string {
    if (!this.pending.some((p) => p.key === key) && !this.geoIds.has(key)) this.pending.push({ key, batch, geo: make() });
    return key;
  }
  private part(lv: Live, key: string, batch: BatchId, pose: Part['pose'], opts: { when?: Part['when']; glow?: Part['glow']; animated?: boolean } = {}): void {
    const p: Part & { geoKey: string } = { batch, inst: -1, pose, animated: opts.animated ?? false, geoKey: key };
    if (opts.when) p.when = opts.when;
    if (opts.glow) p.glow = opts.glow;
    lv.parts.push(p);
    this.instCount[batch]++;
  }
  private s(): number { return this.seed++; }

  private parts(lv: Live): void {
    const d = lv.def, still = (_: Live, __: number, out: THREE.Matrix4) => { out.identity(); };
    switch (d.kind) {
      case 'chest': {
        const look = d.look ?? 'chest', D = Mdl.CHEST_DIMS[look];
        this.part(lv, this.geo(`chest:${look}`, 'lit', () => Mdl.chestBase(look, this.s())), 'lit', still);
        this.part(lv, this.geo(`lid:${look}`, 'lit', () => Mdl.chestLid(look, this.s())), 'lit', (l, _t, out) => T(0, D.h, -D.d / 2, out, -1.95 * ease(l.anim)), { animated: true });
        this.part(lv, this.geo(`glint:${look}`, 'glow', () => Mdl.chestGlint(look, this.s())), 'glow', still, { when: (l) => l.anim > 0.3, glow: (_l, t) => 1.4 + 0.3 * Math.sin(t * 5) });
        if (d.lock !== undefined) this.part(lv, this.geo('padlock', 'lit', () => Mdl.padlock(this.s())), 'lit', (_l, _t, out) => T(0, D.h - 0.12, D.d / 2 + 0.05, out), { when: (l) => l.anim === 0 && !this.host.flags.has(`open:${l.def.id}`) });
        break;
      }
      case 'key':
        this.part(lv, this.geo('key', 'glow', () => Mdl.keyModel(this.s())), 'glow', bob(0.9, 0.08, 1.6), { animated: true, glow: pulse(1.5) });
        break;
      case 'pickup': {
        const look = d.look;
        if (look === 'flint') this.part(lv, this.geo('flint', 'lit', () => Mdl.flintKit(this.s())), 'lit', still);
        else if (look === 'seaglass') this.part(lv, this.geo('seaglass', 'glow', () => Mdl.seaGlass(this.s())), 'glow', bob(0.45, 0.07, 1.1), { animated: true, glow: pulse(2.2) });
        else if (look === 'coin') this.part(lv, this.geo('coin', 'glow', () => Mdl.coinModel(this.s())), 'glow', bob(0.6, 0.06, 2.4), { animated: true, glow: pulse(1.4) });
        else this.part(lv, this.geo('shard', 'glow', () => Mdl.glyphShard(this.s())), 'glow', bob(1.2, 0.12, 0.9), { animated: true, glow: pulse(2.2) });
        break;
      }
      case 'door': {
        const { w, h, look } = d;
        this.part(lv, this.geo(`frame:${look}:${w}:${h}`, 'lit', () => Mdl.doorFrame(look, w, h, this.s())), 'lit', still);
        const pk = this.geo(`panel:${look}:${w}:${h}`, 'lit', () => Mdl.doorPanel(look, w, h, this.s()));
        if (look === 'plank') this.part(lv, pk, 'lit', (l, _t, out) => T(-w / 2, 0, 0, out, 0, -1.75 * ease(l.anim)), { animated: true });
        else this.part(lv, pk, 'lit', (l, _t, out) => T(0, (h + 0.05) * ease(l.anim), 0, out), { animated: true });
        break;
      }
      case 'lever':
        this.part(lv, this.geo('lever-base', 'lit', () => Mdl.leverBase(this.s())), 'lit', still);
        this.part(lv, this.geo('lever-handle', 'lit', () => Mdl.leverHandle(this.s())), 'lit', (l, _t, out) => T(0, 0.34, 0, out, 0.7 - 1.4 * ease(l.anim)), { animated: true });
        break;
      case 'plate': {
        const sz = d.size;
        this.part(lv, this.geo(`plate-rim:${sz}`, 'lit', () => Mdl.plateRim(sz, this.s())), 'lit', still);
        this.part(lv, this.geo(`plate:${sz}`, 'lit', () => Mdl.plateSlab(sz, this.s())), 'lit', (l, _t, out) => T(0, -0.06 * l.anim, 0, out), { animated: true });
        break;
      }
      case 'barrel':
        this.part(lv, this.geo('barrel', 'lit', () => Mdl.barrel(this.s())), 'lit', still);
        break;
      case 'beacon':
        this.part(lv, this.geo('brazier', 'lit', () => Mdl.brazier(this.s())), 'lit', still);
        this.part(lv, this.geo('flame', 'glow', () => Mdl.flame(this.s())), 'glow', (l, t, out) => {
          const f = ease(l.anim), fl = 1 + 0.12 * Math.sin(t * 13) + 0.07 * Math.sin(t * 29 + 1);
          out.compose(_v.set(0, 0.95, 0), _q.setFromEuler(_e.set(0, t * 0.7, 0)), _s.set(f * (1 + 0.05 * Math.sin(t * 17)), f * fl, f));
        }, { when: (l) => l.anim > 0.01, glow: (_l, t) => 2.2 + 0.4 * Math.sin(t * 11), animated: true });
        break;
      case 'bench':
        this.part(lv, this.geo('bench', 'lit', () => Mdl.bench(this.s())), 'lit', still);
        break;
      case 'altar': {
        const n = d.fills.length;
        this.part(lv, this.geo(`altar:${n}`, 'lit', () => Mdl.altar(n, this.s())), 'lit', still);
        d.fills.forEach((f, i) => {
          const s = Mdl.altarSocket(i, n);
          this.part(lv, this.geo('shard', 'glow', () => Mdl.glyphShard(this.s())), 'glow', (_l, t, out) => T(s.x, s.y + Math.sin(t * 1.3 + i) * 0.04, s.z, out, 0, t * 0.8 + i, 0, 0.8),
            { animated: true, when: (l) => this.host.flags.has(`used:${l.def.id}`) && this.host.flags.has(f), glow: pulse(2.4) });
        });
        break;
      }
      default: break;
    }
  }

  private placeLive(lv: Live): void {
    const d = lv.def, p = this.host.place(d.at);
    lv.position.set(p.x, p.y, p.z); lv.yaw = p.yaw; lv.home.copy(lv.position);
    if (d.kind === 'pickup' && d.color !== undefined) lv.tint.set(d.color);
    // colliders
    const box = (hw: number, hd: number, h: number): Collider => ({ x: p.x, z: p.z, hw, hd, rot: -p.yaw, yTop: p.y + h, yBottom: p.y - 0.5 });
    switch (d.kind) {
      case 'chest': { const D = Mdl.CHEST_DIMS[d.look ?? 'chest']; lv.collider = box(D.w / 2, D.d / 2, D.h + D.lidH); break; }
      case 'door': lv.collider = box(d.w / 2 + 0.05, 0.16, d.h); break;
      case 'barrel': {
        // a free dynamic cylinder the player's capsule tips and rolls (PHYSICS P7-L1); a static box where there is no world (tests)
        const bodies = activeBodies();
        lv.rot.setFromAxisAngle(_v.set(0, 1, 0), p.yaw);
        if (bodies) {
          lv.body = bodies.spawn({ ...BARREL_BODY, owner: lv }, { x: p.x, y: p.y + BARREL_HALF + 0.01, z: p.z }, undefined, lv.rot);
          lv.watch = new BarrelWatch(lv.home, d.leash);
        } else lv.collider = box(BARREL_R, BARREL_R, 1.0);
        break;
      }
      case 'beacon': lv.collider = box(0.5, 0.5, 1.2); break;
      case 'altar': lv.collider = box(0.7, 0.7, 1.2); break;
      case 'lever': lv.collider = box(0.22, 0.18, 0.4); break;
      case 'key': case 'pickup': case 'plate': case 'bench': break;
      default: break;
    }
    if (lv.collider) this.host.player.colliders.push(lv.collider);
    // the prompt
    if (d.kind !== 'plate' && d.kind !== 'barrel' && !(d.kind === 'pickup' && d.touch === true)) {
      const pos = new THREE.Vector3(p.x, p.y + (d.kind === 'door' ? 1.1 : d.kind === 'key' ? 1.0 : 0.6), p.z);
      const radius = () => this.promptRadius(lv), label = () => this.label(lv);
      const prompt: Interactable = {
        position: pos,
        get radius() { return radius(); },
        get label() { return label(); },
        onInteract: () => { this.interact(lv); },
      };
      lv.prompt = prompt;
      setSight(prompt, { slack: this.sightSlack(lv), body: lv.collider });
      this.host.prompts.push(prompt);
    }
    // the initial state from the flags (a reload keeps an opened chest open)
    lv.anim = lv.target = this.stateTarget(lv);
  }

  /** the row's own half-size + 0.2: a hit that close to the prompt point is the thing itself */
  private sightSlack(lv: Live): number {
    const d = lv.def;
    switch (d.kind) {
      case 'chest': { const D = Mdl.CHEST_DIMS[d.look ?? 'chest']; return Math.max(D.w, D.d) / 2 + 0.2; }
      case 'door': return d.w / 2 + 0.25;
      case 'beacon': return 0.7;
      case 'altar': return 0.9;
      case 'bench': return 0.8;
      case 'lever': return 0.45;
      case 'key': case 'pickup': return 0.3;
      case 'plate': case 'barrel': return SIGHT_SLACK;   // no prompt
      default: return SIGHT_SLACK;
    }
  }

  private updateCollider(lv: Live): void {
    if (lv.prompt) lv.prompt.position.set(lv.position.x, lv.position.y + (lv.def.kind === 'door' ? 1.1 : lv.def.kind === 'key' ? 1.0 : 0.6), lv.position.z);
    if (!lv.collider) return;
    lv.collider.x = lv.position.x; lv.collider.z = lv.position.z;
  }

  // ── state ──────────────────────────────────────────────────────────────────────────────────────

  private has(f: string): boolean { return this.host.flags.has(f); }

  private stateTarget(lv: Live): number {
    const d = lv.def, a = autoFlag(d);
    switch (d.kind) {
      case 'door': return this.has(`open:${d.id}`) || (d.opensWhen !== undefined && test(this.host.flags, d.opensWhen)) ? 1 : 0;
      case 'plate': return this.has(`plate:${d.id}`) ? 1 : 0;
      case 'key': case 'pickup': return 0;
      case 'chest': case 'lever': case 'beacon': case 'bench': case 'altar': case 'barrel': return a !== null && this.has(a) ? 1 : 0;
      default: return 0;
    }
  }

  private refresh(first = false): void {
    for (const lv of this.lives) {
      const d = lv.def;
      const taken = (d.kind === 'key' || d.kind === 'pickup') && this.has(`taken:${d.id}`);
      const shown = !taken && test(this.host.flags, d.showWhen);
      if (shown !== lv.shown || first) {
        lv.shown = shown; lv.dirty = true;
        lv.body?.setEnabled(shown);
        if (d.kind === 'door') this.syncDoor(lv);
        else if (lv.collider) { if (shown) this.updateColliderOn(lv); else Object.assign(lv.collider, PARKED); }
      }
      const tg = this.stateTarget(lv);
      if (tg !== lv.target) { lv.target = tg; lv.dirty = true; }
      // a latching door whose condition came true stays open
      if (d.kind === 'door' && d.latch === true && d.opensWhen !== undefined && !this.has(`open:${d.id}`) && test(this.host.flags, d.opensWhen)) {
        this.host.flags.set(`open:${d.id}`);
        this.emit({ type: 'door', def: d, text: d.toast ?? 'Something opened', at: lv.position });
      }
    }
  }
  /**
   * A door is solid only when it is shut (PHYSICS.md: "solid when shut, never stuck on the player"): its box is parked
   * while it swings (0 < anim < 1) and while it stands open, and comes back once anim is 0 — and the player is not
   * standing in it, so a door that closes on you waits until you step out.
   */
  private syncDoor(lv: Live): void {
    const c = lv.collider; if (!c) return;
    const solid = lv.shown && lv.anim === 0 && !this.playerIn(lv, c);
    if (solid && parked(c)) this.updateColliderOn(lv);
    else if (!solid && !parked(c)) Object.assign(c, PARKED);
  }
  /** is the player's body (feet + 1.8 m, radius PLAYER_R) inside the door's box where it stands when on? */
  private playerIn(lv: Live, c: Collider): boolean {
    const pl = this.host.player.position, y = lv.position.y, h = lv.def.kind === 'door' ? lv.def.h : 1.2;
    if (pl.y > y + h || pl.y + 1.8 < y - 0.5) return false;
    const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot), dx = pl.x - c.x, dz = pl.z - c.z;
    return Math.abs(dx * cos - dz * sin) < c.hw + PLAYER_R && Math.abs(dx * sin + dz * cos) < c.hd + PLAYER_R;
  }
  private updateColliderOn(lv: Live): void {
    const c = lv.collider; if (!c) return;
    const d = lv.def, y = lv.position.y;
    const h = d.kind === 'door' ? d.h : d.kind === 'chest' ? 0.7 : d.kind === 'barrel' ? 1 : 1.2;
    c.x = lv.position.x; c.z = lv.position.z; c.yTop = y + h; c.yBottom = y - 0.5;
  }

  private promptRadius(lv: Live): number {
    if (!lv.shown) return 0;
    const d = lv.def;
    if (d.reach !== undefined) return this.baseRadius(lv) > 0 ? d.reach : 0;
    return this.baseRadius(lv);
  }
  private baseRadius(lv: Live): number {
    const d = lv.def;
    switch (d.kind) {
      case 'chest': return this.has(`open:${d.id}`) ? 0 : PROMPT_R;
      case 'door': return lv.anim > 0.02 && d.look !== 'plank' ? 0 : d.opensWhen !== undefined && d.lock === undefined && d.requires === undefined ? 0 : PROMPT_R;
      case 'beacon': return this.has(`lit:${d.id}`) ? 0 : PROMPT_R + 0.4;
      case 'altar': return this.has(`used:${d.id}`) ? 0 : PROMPT_R + 0.3;
      case 'bench': return PROMPT_R + 0.5;
      case 'lever': return d.latch === true && this.has(`lever:${d.id}`) ? 0 : PROMPT_R;
      case 'key': case 'pickup': return PROMPT_R;
      case 'plate': case 'barrel': return 0;
      default: return PROMPT_R;
    }
  }

  private locked(lv: Live): string | null {
    const d = lv.def;
    if (!test(this.host.flags, d.requires)) return d.lockedLabel ?? 'Locked';
    if ((d.kind === 'chest' || d.kind === 'door') && d.lock !== undefined && !this.has(`key:${d.lock}`) && !this.has(`open:${d.id}`)) return d.lockedLabel ?? 'Locked — it needs a key';
    return null;
  }

  private label(lv: Live): string {
    const d = lv.def, lock = this.locked(lv);
    if (lock !== null) return lock;
    switch (d.kind) {
      case 'chest': return d.lock !== undefined ? `Unlock the ${d.look === 'strongbox' ? 'strongbox' : 'chest'}` : `Open the ${d.look === 'strongbox' ? 'strongbox' : d.look === 'treasure' ? 'treasure chest' : 'chest'}`;
      case 'key': return `Take ${d.label}`;
      case 'pickup': return `Take ${d.label}`;
      case 'door': return d.lock !== undefined && !this.has(`open:${d.id}`) ? 'Unlock' : lv.target > 0 ? 'Close' : 'Open';
      case 'lever': return d.label ?? (this.has(`lever:${d.id}`) ? 'Push the lever back' : 'Pull the lever');
      case 'beacon': return d.label;
      case 'bench': return d.label;
      case 'altar': return d.label;
      case 'plate': case 'barrel': return '';
      default: return '';
    }
  }

  private emit(e: InteractEvent): void { this.onEvent?.(e); }

  private interact(lv: Live): void {
    const d = lv.def, F = this.host.flags, at = lv.position;
    if (!lv.shown) return;
    const lock = this.locked(lv);
    if (lock !== null) { this.emit({ type: 'locked', def: d, text: lock, at }); return; }
    const raise = () => { const a = autoFlag(d); if (a !== null) F.set(a); for (const s of d.sets ?? []) F.set(s); };
    switch (d.kind) {
      case 'chest': {
        raise();
        this.emit({ type: 'open', def: d, text: d.toast ?? '', at });
        for (const l of d.loot) {
          if ('item' in l) this.emit({ type: 'loot', def: d, item: l.item, n: l.n ?? 1, at });
          else if ('key' in l) { F.set(`key:${l.key}`); this.emit({ type: 'loot', def: d, text: `Found ${l.label}`, at }); }
          else { F.set(l.flag); this.emit({ type: 'loot', def: d, text: `Found ${l.label}`, flag: l.flag, at }); }
        }
        break;
      }
      case 'key': F.set(`key:${d.key}`); raise(); this.emit({ type: 'take', def: d, text: d.toast ?? `Took ${d.label}`, at }); break;
      case 'pickup': this.take(lv); break;
      case 'door': {
        if (d.look === 'plank' && F.has(`open:${d.id}`)) { F.clear(`open:${d.id}`); this.emit({ type: 'door', def: d, text: '', at }); break; }
        raise(); this.emit({ type: 'door', def: d, text: d.toast ?? '', at });
        break;
      }
      case 'lever': {
        if (d.latch === true && F.has(`lever:${d.id}`)) break;
        const on = F.toggle(`lever:${d.id}`);
        for (const s of d.sets ?? []) F.set(s, on);
        this.emit({ type: 'lever', def: d, text: d.toast ?? '', at });
        break;
      }
      case 'beacon': raise(); this.emit({ type: 'light', def: d, text: d.toast ?? 'The beacon is lit', at }); break;
      case 'bench': raise(); this.emit({ type: 'sit', def: d, text: d.toast ?? '', at }); this.onSit?.(lv.position, lv.yaw); break;
      case 'altar': raise(); this.emit({ type: 'use', def: d, text: d.toast ?? '', at }); break;
      case 'plate': case 'barrel': break;
      default: break;
    }
  }

  private take(lv: Live): void {
    const d = lv.def; if (d.kind !== 'pickup') return;
    const F = this.host.flags;
    F.set(`taken:${d.id}`); for (const s of d.sets ?? []) F.set(s);
    this.emit({ type: 'take', def: d, text: d.toast ?? d.label, ...(d.item !== undefined ? { item: d.item, n: 1 } : {}), at: lv.position });
  }

  // ── per frame ──────────────────────────────────────────────────────────────────────────────────

  update(dt: number, t: number): void {
    const pl = this.host.player.position, F = this.host.flags, physics = activePhysics();
    // barrels first: their pose from the body (plates feel the body itself)
    for (const lv of this.lives) if (lv.def.kind === 'barrel' && lv.shown) this.syncBarrel(lv, dt);
    for (const lv of this.lives) {
      const d = lv.def;
      if (!lv.shown) { if (lv.dirty) this.pose(lv, t); continue; }
      if (d.kind === 'plate') {
        const down = physics !== null && plateDown(physics, lv, d.size, d.by);
        if (down !== F.has(`plate:${d.id}`)) { F.set(`plate:${d.id}`, down); for (const s of d.sets ?? []) F.set(s, down); this.emit({ type: down ? 'press' : 'release', def: d, at: lv.position }); }
      } else if (d.kind === 'pickup' && d.touch === true) {
        const dx = pl.x - lv.position.x, dz = pl.z - lv.position.z;
        // walk-in take: within TOUCH_R of your feet, and seen from your chest (not through a deck, hull or wall)
        if (dx * dx + dz * dz < TOUCH_R * TOUCH_R && Math.abs(pl.y - lv.position.y) < 2.2
          && (!physics || lineOfSight(physics, _chest.set(pl.x, pl.y + 1.0, pl.z), { x: lv.position.x, y: lv.position.y + 0.5, z: lv.position.z }, 0.3))) this.take(lv);
      }
      if (lv.anim !== lv.target) {
        const speed = d.kind === 'door' && d.look !== 'plank' ? 0.7 : d.kind === 'plate' ? 6 : d.kind === 'beacon' ? 1.2 : 2.4;
        lv.anim = lv.target > lv.anim ? Math.min(lv.target, lv.anim + dt * speed) : Math.max(lv.target, lv.anim - dt * speed);
        lv.dirty = true;
      }
      if (d.kind === 'door') this.syncDoor(lv);
      // bobbing / flickering parts: only near the camera (a sea-glass piece 200 m off is culled anyway)
      if (!lv.dirty && lv.parts.some((p) => p.animated && p.glow !== undefined) && lv.position.distanceToSquared(pl) < 90 * 90) lv.dirty = true;
      if (lv.dirty) this.pose(lv, t);
    }
  }

  private pose(lv: Live, t: number): void {
    lv.dirty = false;
    _m.compose(lv.position, lv.def.kind === 'barrel' ? lv.rot : _q.setFromAxisAngle(_v.set(0, 1, 0), lv.yaw), _s.set(1, 1, 1));
    for (const p of lv.parts) {
      const bm = this.batches[p.batch];
      const vis = lv.shown && (p.when ? p.when(lv) : true);
      bm.setVisibleAt(p.inst, vis);
      if (!vis) continue;
      p.pose(lv, t, _local);
      bm.setMatrixAt(p.inst, _local.premultiply(_m));
      if (p.glow) bm.setColorAt(p.inst, _c.copy(lv.tint).multiplyScalar(p.glow(lv, t)));
    }
  }

  /**
   * The barrel's pose from its body — its full turn, interpolated between fixed steps — and the never-jam rule
   * (`BarrelWatch`): past its leash, lost in the sea or under the world, or wedged, it goes home upright.
   */
  private syncBarrel(lv: Live, dt: number): void {
    const b = lv.body, bodies = activeBodies();
    if (b === null || bodies === null) return;
    b.pose(bodies.alpha, _bp, _bq);
    _q.set(_bq.x, _bq.y, _bq.z, _bq.w);
    _v.set(0, -BARREL_HALF, 0).applyQuaternion(_q).add(_bp); // the base centre (the model's origin)
    if (lv.position.distanceToSquared(_v) + lv.rot.angleTo(_q) > 1e-10) {
      lv.position.copy(_v); lv.rot.copy(_q); lv.dirty = true;
    }
    if (lv.watch?.check(b.curr, dt, this.barrelEnv) === true) this.sendHome(lv, b, true);
  }

  /** what `BarrelWatch` reads of the world: the player, the floor, the sea, the plates */
  private envCache: BarrelEnv | null = null;
  private get barrelEnv(): BarrelEnv {
    this.envCache ??= this.makeEnv();
    return this.envCache;
  }
  private makeEnv(): BarrelEnv {
    return {
      player: this.host.player,
      floorAt: (x, z) => this.host.floorAt(x, z),
      water: () => waterLevel(),
      onPlate: (c) => this.lives.some((p) => p.def.kind === 'plate' && p.shown
        && Math.hypot(c.x - p.position.x, c.z - p.position.z) < p.def.size / 2 + PLATE_NEAR && Math.abs(c.y - p.position.y) < 1.2),
    };
  }

  /** the barrel back at its start, upright, at rest ("The barrel rolls back to where it was") */
  private sendHome(lv: Live, b: Body, announce = false): void {
    const d = lv.def; if (d.kind !== 'barrel') return;
    lv.rot.setFromAxisAngle(_v.set(0, 1, 0), lv.yaw);
    b.teleport({ x: lv.home.x, y: lv.home.y + BARREL_HALF + 0.01, z: lv.home.z }, lv.rot);
    lv.position.copy(lv.home); lv.dirty = true;
    lv.watch?.clear();
    if (announce) this.emit({ type: 'barrel-reset', def: d, text: d.toast ?? 'The barrel rolls back to where it was', at: lv.position });
  }
}

const SEES_PLAYER: readonly GroupName[] = ['PLAYER'], SEES_ITEM: readonly GroupName[] = ['ITEM'], SEES_ANY: readonly GroupName[] = ['PLAYER', 'ITEM'];
const isBarrel = (owner: unknown): boolean => owner instanceof Live && owner.def.kind === 'barrel';
const anyOwner = (): boolean => true;

/**
 * Is something on the plate? (PHYSICS P5-L3 → P7) An overlap query of a thin slab just over the plate, a little inside
 * its rim, against the player's capsule (`by: 'player'`), a barrel's body (`'barrel'`) or either / any item (`'any'`).
 */
export function plateDown(physics: Physics, lv: { position: { x: number; y: number; z: number }; yaw: number }, size: number, by: 'player' | 'barrel' | 'any'): boolean {
  const h = Math.max(0.05, size / 2 - PLATE_INSET);
  const at = { x: lv.position.x, y: lv.position.y + PLATE_DEPTH / 2, z: lv.position.z }, half = { x: h, y: PLATE_DEPTH, z: h };
  return by === 'player' ? overlapBox(physics, at, half, lv.yaw, SEES_PLAYER, anyOwner)
    : by === 'barrel' ? overlapBox(physics, at, half, lv.yaw, SEES_ITEM, isBarrel)
      : overlapBox(physics, at, half, lv.yaw, SEES_ANY, anyOwner);
}

function ease(x: number): number { return x * x * (3 - 2 * x); }
function bob(h: number, amp: number, spin: number): Part['pose'] {
  return (lv, t, out) => T(0, h + Math.sin(t * 1.8 + lv.home.x) * amp, 0, out, 0, t * spin, 0);
}
function pulse(base: number): Part['glow'] {
  return (lv, t) => base + 0.35 * Math.sin(t * 2.6 + lv.home.z);
}
