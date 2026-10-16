import type * as THREE from 'three';
import { floorAtRects, type BoxSpec } from '@wildshard/engine/physics/box';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { SiteLights, type LightSite, type SiteFlicker, type SiteLightsLook, type SiteWave } from '@wildshard/engine/fx/SiteLights';

/**
 * A settlement's buildings as a living place (SHARD-PLATFORM M3, the props system): whatever builds the buildings hands
 * their moving parts and floor queries here (doors, fires and lamps, lantern swings, wheels),
 * and this runs them: the doors swing on use (eased, barred by the caller's rule, heard
 * by listeners) with a kinematic leaf piece each; the fires, lamps and the phone's shared lights are the engine's
 * SiteLights (fires burn all day, lamps light at dusk); lamp glass glows with the night. Every number is the shard's
 * look row; nothing here knows a shard's buildings.
 */

/** A door: its pivot (turned about +Y as it swings), its state, its legacy box, its use prompt and its leaf in the pivot's frame. */
export interface BuildingDoor {
  id: string; pivot: THREE.Object3D; open: boolean; t: number; collider: BoxSpec; interactable: Interactable;
  /** the leaf as a box in the pivot's local frame */
  slab: ColliderDesc;
}
/** A swinging pivot (a hung lantern) and its seed. */
export interface BuildingSwing { pivot: THREE.Object3D; seed: number }
/** A floor / deck rectangle in world space (turned by `rot`) and its top. */
export interface BuildingFloor { x: number; z: number; rot: number; hw: number; hd: number; y: number }
/** One wave of a clock motion: sin(t × rate + seed × seedScale) × amount. */
export type BuildingWave = SiteWave;

/** How the buildings move and light (a shard's data row). */
export interface BuildingLifeLook extends SiteLightsLook {
  /** a door's swing: seconds end to end (eased in-out) and its open angle (radians, inward) */
  readonly door: { readonly seconds: number; readonly angle: number };
  /** intensity by the night's `lamps` (0 day … 1 night): base + gain × lamps, for fires, lamps and lamp glass */
  readonly fire: readonly [number, number];
  readonly lamp: readonly [number, number];
  readonly glass: readonly [number, number];
  /** a swing: rotation.z = Σ z waves, rotation.x = cos(t × x[0] + seed) × x[1] */
  readonly swing: { readonly z: readonly BuildingWave[]; readonly x: readonly [number, number] };
}

const wave = (t: number, seed: number, w: BuildingWave): number => Math.sin(t * w[0] + seed * w[1]) * w[2];

/** A settlement's buildings as a living place (see the module comment). */
export class BuildingLife {
  /** radians per second of every wheel (0 stops them) */
  wheelSpeed = 0.55;
  interactables: Interactable[] = [];
  firePits: { x: number; y: number; z: number }[] = [];
  private readonly lifeLook: BuildingLifeLook;
  private wheels: THREE.Object3D[] = [];
  private doors: BuildingDoor[] = [];
  /** the fires, lamps and the shared lights (the buildings and the lamp sites, in that order) */
  private readonly lights: SiteLights;
  /** each light kind's gain this frame (fires and lamps by the night) */
  private readonly gain = { fire: 1, lamp: 1 };
  private swings: BuildingSwing[] = [];
  private floors: BuildingFloor[] = [];
  /** emissive materials lit by the clock and their full-night intensity */
  private lampMats: { mat: THREE.MeshStandardMaterial; full: number }[] = [];
  private readonly doorBars = new Map<Interactable, () => boolean>();
  private readonly doorListeners = new Set<(door: Interactable, opening: boolean) => void>();

  constructor(look: BuildingLifeLook) {
    this.lifeLook = look;
    this.lights = new SiteLights(look);
  }

  /**
   * One piece per door: the leaf in its pivot's frame, for a kinematic body that follows the pivot. `swinging()` is true
   * from the moment the door is used until it is fully shut or fully open.
   */
  doorPieces(): { id: string; pivot: THREE.Object3D; colliders: ColliderDesc[]; swinging: () => boolean }[] {
    return this.doors.map((d) => ({ id: d.id, pivot: d.pivot, colliders: [d.slab], swinging: () => d.t !== (d.open ? 1 : 0) }));
  }

  /** world y of a floor / deck under (x, z), if inside one */
  floorHeightAt(x: number, z: number): number | undefined { return floorAtRects(this.floors, x, z, 'first'); }

  /** Per frame, the eye at `eye`, the night's `lamps` (0 day … 1 night): wheels, the shared lights, doors, flicker, glass, swings. */
  tick(dt: number, t: number, eye: THREE.Vector3, lamps: number): void {
    const look = this.lifeLook;
    for (const w of this.wheels) w.rotation.x += dt * this.wheelSpeed;
    for (const d of this.doors) {
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t = Math.max(0, Math.min(1, d.t + Math.sign(target - d.t) * dt / look.door.seconds));
      const e = d.t < 0.5 ? 2 * d.t * d.t : 1 - (-2 * d.t + 2) ** 2 / 2; // ease in-out
      d.pivot.rotation.y = -e * look.door.angle;
    }
    this.gain.fire = look.fire[0] + look.fire[1] * lamps; this.gain.lamp = look.lamp[0] + look.lamp[1] * lamps;
    this.lights.step(t, eye, this.gain);
    for (const m of this.lampMats) m.mat.emissiveIntensity = m.full * (look.glass[0] + look.glass[1] * lamps);
    for (const sw of this.swings) {
      let z = 0;
      for (const w of look.swing.z) z += wave(t, sw.seed, w);
      sw.pivot.rotation.z = z; sw.pivot.rotation.x = Math.cos(t * look.swing.x[0] + sw.seed) * look.swing.x[1];
    }
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
  _door(d: BuildingDoor): void { this.doors.push(d); this.interactables.push(d.interactable); }
  /** a light of its own that flickers */
  _fire(f: SiteFlicker): void { this.lights.addFlicker(f); }
  /** an emissive material lit by the clock, at `full` by night */
  _lamp(mat: THREE.MeshStandardMaterial, full: number): void { this.lampMats.push({ mat, full }); }
  /** a swinging pivot */
  _swing(sw: BuildingSwing): void { this.swings.push(sw); }
  /** a floor / deck */
  _floor(f: BuildingFloor): void { this.floors.push(f); }
  /** a wheel turning about its x axis */
  _wheel(o: THREE.Object3D): void { this.wheels.push(o); }
  /** a fire pit's position (audio / warmth) */
  _firePit(at: { x: number; y: number; z: number }): void { this.firePits.push(at); }
  /** a site the shared lights may visit (in visiting order of registration) */
  addSite(site: LightSite): void { this.lights.addSite(site); }
  /** a shared point light the nearest site's anchors take */
  addSharedLight(light: THREE.PointLight): void { this.lights.addLight(light); }
  /** a lone lamp the shared lights may visit when it is the nearest lit site (a waystone lantern; no light of its own) */
  addLampSite(anchor: THREE.Object3D, color: number, intensity: number, distance: number, lit?: () => boolean): void { this.lights.addLamp(anchor, color, intensity, distance, lit); }
}
