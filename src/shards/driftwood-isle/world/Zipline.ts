/**
 * Zipline — the traversal reward (DRIFTWOOD-REMASTER A7): a plank launch deck jutting out over the headland's
 * cliff a short walk down from the lookout, a steel cable sagging 50-odd metres down to a padded post on the Wreck
 * Cove beach beside the sea cave, and a pulley trolley with a T-bar you hang from. "[E] Ride the zipline" and you
 * go: gravity along the cable minus drag (12–16 m/s at the bottom), the trolley sings along the wire, you let go
 * on the sand with the last of the speed. Two draws: the rig (deck + posts + cable + landing, one merged mesh) and
 * the trolley — the zipline model's geometry (E306 / E315 M1: src/shards/driftwood-isle/models/zipline.ts), built
 * where it stands; this is the ride, and `place` puts the model's card on what it draws (drawnInto, piece `zipline`).
 *
 *   const zip = new Zipline(sky, { top, bottom }).build();       // top = the deck's outer edge (floor), bottom = the landing (floor)
 *   zip.place(registry); scene.add(zip.group); prompts.push(zip.prompt);   // the game (the deck collides: piece `zipline`)
 *   scene.add(zip.group); player.platforms.push((x, z) => zip.floorHeightAt(x, z));   // a dev scene
 *   game.onUpdate((dt) => zip.update(dt, player));                // after player.update: while riding it owns the position
 *   zip.onRide = (on) => …                                        // lower the viewmodel, sound, achievement
 *
 * Why not straight off the lookout platform (the model's `zipTop`): the headland's top is a flat 34 m shelf for 30 m
 * before its cliff; any cable from the platform down to the cove passes 10 m under that shelf. The deck sits at the
 * cliff lip on the line from the platform to the cave, so it still reads as the lookout's zipline.
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { zipline, ziplineGeometry } from '../models/zipline';
import { ZiplineDriver, CableLayout, type ZiplineSpec } from '@wildshard/sdk/movers';


const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class Zipline {
  readonly group = new THREE.Group();
  readonly prompt: Interactable;
  onRide?: (on: boolean) => void;
  /** the cable's two ends (world) */
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  private trolley!: THREE.Mesh;
  private readonly driver: ZiplineDriver;
  private readonly lay: CableLayout;
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;

  constructor(private sky: Sky, private spec: ZiplineSpec, row: ConstructorParameters<typeof ZiplineDriver>[0]) {
    const lay = this.lay = new CableLayout(spec);
    this.a = lay.a; this.b = lay.b;
    this.driver = new ZiplineDriver(row, on => { if (!on) this.parkTrolley(); this.onRide?.(on); });
    const flat = lay.flat;
    const promptAt = V(this.a.x - flat.x * 0.6, lay.deck.y + 1.0, this.a.z - flat.z * 0.6), riding = () => this.driver.isRiding;
    this.prompt = {
      position: promptAt,
      get radius() { return riding() ? 0 : 2.4; },
      label: 'Ride the zipline',
      onInteract: () => { this.start(); },
    };
  }

  /** a point on the cable at arc position s (0 … len), sagging as a parabola */
  at(s: number, out: THREE.Vector3): THREE.Vector3 { return this.lay.at(s, out); }

  build(): this {
    const { rig, trolley } = ziplineGeometry(this.lay);
    const mat = lowPolyMaterial(this.sky);
    const mesh = new THREE.Mesh(rig, mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'zipline';
    this.trolley = new THREE.Mesh(trolley, mat);
    this.trolley.castShadow = true;
    this.parkTrolley();
    this.group.add(mesh, this.trolley);
    return this;
  }

  /** the game's: the zipline model's card on what it draws, and the deck's colliders (piece `zipline`); add `group` to the scene */
  place(registry: WorldRegistry): this {
    const t = this.spec.top, b = this.spec.bottom;
    const box = new THREE.Box3().setFromObject(this.group);
    this.placed = place(zipline, [{ x: t.x, y: t.y, z: t.z, params: { top: { x: t.x, y: t.y, z: t.z }, bottom: { x: b.x, y: b.y, z: b.z } } }], { ctx: modelContext(this.sky), draw: 'merged', registry,
      drawnInto: { object: this.group, boxes: Float32Array.from([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]), colliders: this.colliderDescs() },
      piece: { id: 'zipline', floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    return this;
  }

  /** the deck is walkable */
  floorHeightAt(x: number, z: number): number | undefined {
    const d = this.lay.deck, dx = x - d.x, dz = z - d.z, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) <= d.hw && Math.abs(lz) <= d.hd ? d.y : undefined;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — every floor `floorHeightAt` describes, as real
   * geometry (it has no legacy boxes). src/engine/physics/pieces.ts turns it into Rapier colliders. The launch deck: a 0.2 m
   * slab, its top the deck floor, its footprint the deck's. The deck stands 0.37–0.85 m off the rock (DECK_H); the old
   * 0.5 m step-up climbed it only on its +x side (0.37–0.47 m, the side toward the lookout path; the back has the rail,
   * the front is the cliff), so that side gets one tread 0.24 m under the deck, 0.45 m deep, down into the rock.
   */
  colliderDescs(): ColliderDesc[] {
    const d = this.lay.deck, hy = 0.1, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const step = 0.24, depth = 0.45, lx = d.hw + depth / 2, bottom = d.y - 1.6, th = (d.y - step - bottom) / 2;
    return [
      { kind: 'box', x: d.x, y: d.y - hy, z: d.z, hx: d.hw, hy, hz: d.hd, yaw: d.yaw },
      { kind: 'box', x: d.x + lx * c, y: bottom + th, z: d.z - lx * s, hx: depth / 2, hy: th, hz: d.hd, yaw: d.yaw },
    ];
  }

  get isRiding(): boolean { return this.driver.isRiding; }

  start(): void { this.driver.start(); }

  private parkTrolley(): void {
    this.trolley.rotation.set(0, this.lay.park(this.trolley.position), 0);
  }

  /** after player.update: while riding, the cable owns the player's position */
  update(dt: number, player: { position: THREE.Vector3; velocity: THREE.Vector3 }): void {
    if (!this.driver.isRiding) return;
    this.driver.update(dt, player);
    this.showTrolley();
  }

  private showTrolley(): void {
    if (this.driver.isRiding) {
      this.at(this.driver.distance, this.trolley.position);
      this.trolley.rotation.z = Math.sin(this.driver.distance * 0.7) * 0.05;
    }
  }
}
