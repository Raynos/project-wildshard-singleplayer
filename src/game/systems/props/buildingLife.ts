import * as THREE from 'three';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';

/**
 * A settlement's buildings as a living place (SHARD-PLATFORM M3, the props system): whatever builds the buildings hands
 * their moving parts here (the doors, the fires and lamps, the lantern swings, the particle clocks, the wheels, the
 * floors and the static solids), and this runs them: the doors swing on use (eased, barred by the caller's rule, heard
 * by listeners) with a kinematic leaf piece each; fires flicker on the clock and lamps light at dusk, by intensity only;
 * a small pool of shared point lights (the phone's) follows the nearest lit site's anchors, its room lights first once
 * the eye is indoors; lamp glass glows with the night. Every number is the shard's look row; nothing here knows a
 * shard's buildings.
 */

/** A door: its pivot (turned about +Y as it swings), its state, its legacy box, its use prompt and its leaf in the pivot's frame. */
export interface BuildingDoor {
  id: string; pivot: THREE.Object3D; open: boolean; t: number; collider: BoxSpec; interactable: Interactable;
  /** the leaf as a box in the pivot's local frame */
  slab: ColliderDesc;
}
/** `fire`: burns all day and only reads stronger at night; `lamp` (a lantern, a room light): lit by the clock. */
export type BuildingLightKind = 'fire' | 'lamp';
/** A flickering light: its base intensity, flicker seed and kind. */
export interface BuildingFlicker { light: THREE.PointLight; base: number; seed: number; kind: BuildingLightKind }
/** A shared light's slot at a site: where, how it looks, and its rank (which anchors take the pool first). */
export interface BuildingLightAnchor { anchor: THREE.Object3D; color: number; intensity: number; distance: number; decay: number; seed: number; kind: BuildingLightKind; rank: number }
/** A room's floor rectangle in its building's frame (inside: the pool lights the room). */
export interface BuildingRoom { x: number; z: number; hw: number; hd: number }
/** A swinging pivot (a hung lantern) and its seed. */
export interface BuildingSwing { pivot: THREE.Object3D; seed: number }
/** A floor / deck rectangle in world space (turned by `rot`) and its top. */
export interface BuildingFloor { x: number; z: number; rot: number; hw: number; hd: number; y: number }
/** A place the shared lights may visit: a building (its anchors, rooms and door in its frame) or a lone lamp. */
export interface BuildingLightSite { root: THREE.Object3D; anchors: BuildingLightAnchor[]; lit?: () => boolean; rooms?: readonly BuildingRoom[]; door?: [number, number] }

/** One wave of a clock motion: sin(t × rate + seed × seedScale) × amount. */
export type BuildingWave = readonly [rate: number, seedScale: number, amount: number];

/** How the buildings move and light (a shard's data row). */
export interface BuildingLifeLook {
  /** a door's swing: seconds end to end (eased in-out) and its open angle (radians, inward) */
  readonly door: { readonly seconds: number; readonly angle: number };
  /** the flicker: 1 + depth × Σ waves */
  readonly flicker: { readonly depth: number; readonly waves: readonly BuildingWave[] };
  /** intensity by the night's `lamps` (0 day … 1 night): base + gain × lamps, for fires, lamps and lamp glass */
  readonly fire: readonly [number, number];
  readonly lamp: readonly [number, number];
  readonly glass: readonly [number, number];
  /** a swing: rotation.z = Σ z waves, rotation.x = cos(t × x[0] + seed) × x[1] */
  readonly swing: { readonly z: readonly BuildingWave[]; readonly x: readonly [number, number] };
  /** indoors: the eye over a room or within `doorRadius` m of the door; then these anchor ranks take the pool first, in order */
  readonly indoor: { readonly doorRadius: number; readonly ranks: readonly number[] };
}

const wave = (t: number, seed: number, w: BuildingWave): number => Math.sin(t * w[0] + seed * w[1]) * w[2];

/** A settlement's buildings as a living place (see the module comment). */
export class BuildingLife {
  /** radians per second of every wheel (0 stops them) */
  wheelSpeed = 0.55;
  colliders: BoxSpec[] = [];
  interactables: Interactable[] = [];
  firePits: { x: number; y: number; z: number }[] = [];
  private readonly lifeLook: BuildingLifeLook;
  private wheels: THREE.Object3D[] = [];
  private doors: BuildingDoor[] = [];
  private fires: BuildingFlicker[] = [];
  private swings: BuildingSwing[] = [];
  private particleMats = new Set<THREE.ShaderMaterial>();
  private floors: BuildingFloor[] = [];
  /** static solids that are only in colliderDescs() (floors, porch, step, plinth, furniture, props) */
  private solids: ColliderDesc[] = [];
  /** the buildings and the lamp sites the shared lights may visit, in that order */
  private sites: BuildingLightSite[] = [];
  /** the shared point lights (taken from the scene's pool by the owner; none: every light is its own) */
  private sharedLights: THREE.PointLight[] = [];
  /** emissive materials lit by the clock and their full-night intensity */
  private lampMats: { mat: THREE.MeshStandardMaterial; full: number }[] = [];
  private nearestSite = -1;
  private indoors = false;
  /** the nearest site's anchors in the order the shared lights take them */
  private order: BuildingLightAnchor[] = [];
  private tmpL = new THREE.Vector3();
  private readonly doorBars = new Map<Interactable, () => boolean>();
  private readonly doorListeners = new Set<(door: Interactable, opening: boolean) => void>();

  constructor(look: BuildingLifeLook) {
    this.lifeLook = look;
  }

  /**
   * Every building's static collision in world space: the legacy boxes minus the door boxes, plus the solids (floors,
   * decks, steps, plinths, furniture).
   */
  colliderDescs(): ColliderDesc[] {
    const doorBoxes = new Set(this.doors.map((d) => d.collider));
    return [...this.colliders.filter((c) => !doorBoxes.has(c)).map((c) => boxDesc(c)), ...this.solids];
  }

  /**
   * One piece per door: the leaf in its pivot's frame, for a kinematic body that follows the pivot. `swinging()` is true
   * from the moment the door is used until it is fully shut or fully open.
   */
  doorPieces(): { id: string; pivot: THREE.Object3D; colliders: ColliderDesc[]; swinging: () => boolean }[] {
    return this.doors.map((d) => ({ id: d.id, pivot: d.pivot, colliders: [d.slab], swinging: () => d.t !== (d.open ? 1 : 0) }));
  }

  /** world y of a floor / deck under (x, z), if inside one */
  floorHeightAt(x: number, z: number): number | undefined {
    for (const f of this.floors) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
      if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd) return f.y;
    }
    return undefined;
  }

  /** Per frame, the eye at `eye`, the night's `lamps` (0 day … 1 night): wheels, the shared lights, doors, flicker, glass, swings, particle clocks. */
  tick(dt: number, t: number, eye: THREE.Vector3, lamps: number): void {
    const look = this.lifeLook;
    let nearest = -1, nearestD2 = Infinity;
    for (const [i, s] of this.sites.entries()) {
      const d2 = s.root.position.distanceToSquared(eye);
      if (s.anchors.length > 0 && d2 < nearestD2 && (s.lit?.() ?? true)) { nearestD2 = d2; nearest = i; }
    }
    for (const w of this.wheels) w.rotation.x += dt * this.wheelSpeed;
    const l = this.sites[nearest];
    if (this.sharedLights.length > 0 && nearest >= 0 && l !== undefined) {
      // indoors (the eye over one of its rooms, or near its door) the room lights take the pool first
      let indoors = false;
      if (l.rooms && l.door) {
        const p = l.root.worldToLocal(this.tmpL.copy(eye));
        indoors = l.rooms.some((r) => Math.abs(p.x - r.x) <= r.hw && Math.abs(p.z - r.z) <= r.hd) || Math.hypot(p.x - l.door[0], p.z - l.door[1]) < look.indoor.doorRadius;
      }
      if (nearest !== this.nearestSite || indoors !== this.indoors) {
        this.nearestSite = nearest; this.indoors = indoors;
        const ranks = look.indoor.ranks;
        const indoorRank = (a: BuildingLightAnchor): number => { const k = ranks.indexOf(a.rank); return k !== -1 ? k : a.rank + ranks.length; };
        this.order = indoors ? [...l.anchors].sort((a, b) => indoorRank(a) - indoorRank(b)) : l.anchors;
        this.fires = this.fires.filter((f) => !this.sharedLights.includes(f.light));
        this.sharedLights.forEach((light, i) => {
          const a = this.order[i];
          if (!a) { light.intensity = 0; return; }
          light.color.set(a.color); light.distance = a.distance; light.decay = a.decay;
          this.fires.push({ light, base: a.intensity, seed: a.seed, kind: a.kind });
        });
      }
      this.sharedLights.forEach((light, i) => { const a = this.order[i]; if (a) a.anchor.getWorldPosition(light.position); });
    }
    for (const d of this.doors) {
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t = Math.max(0, Math.min(1, d.t + Math.sign(target - d.t) * dt / look.door.seconds));
      const e = d.t < 0.5 ? 2 * d.t * d.t : 1 - (-2 * d.t + 2) ** 2 / 2; // ease in-out
      d.pivot.rotation.y = -e * look.door.angle;
    }
    // by intensity only: the light count never changes
    const fireK = look.fire[0] + look.fire[1] * lamps, lampK = look.lamp[0] + look.lamp[1] * lamps;
    for (const f of this.fires) {
      let n = 0;
      for (const w of look.flicker.waves) n += wave(t, f.seed, w);
      f.light.intensity = f.base * (1 + look.flicker.depth * n) * (f.kind === 'fire' ? fireK : lampK);
    }
    for (const m of this.lampMats) m.mat.emissiveIntensity = m.full * (look.glass[0] + look.glass[1] * lamps);
    for (const sw of this.swings) {
      let z = 0;
      for (const w of look.swing.z) z += wave(t, sw.seed, w);
      sw.pivot.rotation.z = z; sw.pivot.rotation.x = Math.cos(t * look.swing.x[0] + sw.seed) * look.swing.x[1];
    }
    for (const m of this.particleMats) { const u = m.uniforms['uTime']; if (u !== undefined) u.value = t; }
  }

  /** bar a door: while `barred()` says true its use does nothing (the caller toasts / plays why) */
  barDoor(door: Interactable, barred: () => boolean): void { this.doorBars.set(door, barred); }
  /** hear every door that moves (`opening`: it swung open); returns the unsubscribe */
  onDoor(fn: (door: Interactable, opening: boolean) => void): () => void { this.doorListeners.add(fn); return () => { this.doorListeners.delete(fn); }; }
  /** a door's use: moved (`toggle`) unless barred, then its listeners told */
  _doorUse(d: BuildingDoor, toggle: () => void): void {
    if (this.doorBars.get(d.interactable)?.() === true) return;
    toggle();
    for (const fn of this.doorListeners) fn(d.interactable, d.open);
  }
  /** a door: swung, collided, prompted */
  _door(d: BuildingDoor): void { this.doors.push(d); this.colliders.push(d.collider); this.interactables.push(d.interactable); }
  /** a light of its own that flickers */
  _fire(f: BuildingFlicker): void { this.fires.push(f); }
  /** an emissive material lit by the clock, at `full` by night */
  _lamp(mat: THREE.MeshStandardMaterial, full: number): void { this.lampMats.push({ mat, full }); }
  /** a swinging pivot */
  _swing(sw: BuildingSwing): void { this.swings.push(sw); }
  /** a particle material whose `uTime` follows the clock */
  _particles(m: THREE.ShaderMaterial): void { this.particleMats.add(m); }
  /** a floor / deck */
  _floor(f: BuildingFloor): void { this.floors.push(f); }
  /** a static solid (only in colliderDescs) */
  _solid(d: ColliderDesc, _prop: boolean): void { this.solids.push(d); }
  /** a wheel turning about its x axis */
  _wheel(o: THREE.Object3D): void { this.wheels.push(o); }
  /** a legacy box */
  _collider(c: BoxSpec): void { this.colliders.push(c); }
  /** a fire pit's position (audio / warmth) */
  _firePit(at: { x: number; y: number; z: number }): void { this.firePits.push(at); }
  /** a site the shared lights may visit (in visiting order of registration) */
  addSite(site: BuildingLightSite): void { this.sites.push(site); }
  /** a shared point light the nearest site's anchors take */
  addSharedLight(light: THREE.PointLight): void { this.sharedLights.push(light); }

  /**
   * A lamp the shared lights may visit when it is the nearest lit site (a waystone lantern): `anchor` sits in world space
   * (a child of a group at the origin). No light of its own; `lit()` false keeps the pool away.
   */
  addLampSite(anchor: THREE.Object3D, color: number, intensity: number, distance: number, lit: () => boolean = () => true): void {
    const a: BuildingLightAnchor = { anchor, color, intensity, distance, decay: 2, seed: anchor.position.x * 0.37, kind: 'lamp', rank: 0 };
    this.sites.push({ root: anchor, anchors: [a], lit });
  }
}
