/**
 * Boat — where the sailboat you arrived in is moored, and how it rides (E306 / E315 M1: the boat itself is the model
 * src/shards/driftwood-isle/models/boat.ts; this is the world side). It places the dinghy beside the pier, runs its
 * mooring lines to the pier's bollards (world geometry between two placed models: a separate static mesh, so they don't
 * bob) and bobs it on the swell in `update(dt)`. Its colliders ride it on a kinematic body (`follows: 'copy'`).
 *
 *   const boat = new Boat(sky, { x: -4.2, z: -244, heading: 0, waterY: 0.8, moorTo: pier.mooringsFor(-4.2, -244) }).place(registry);
 *   const boat = new Boat(sky, { … }).build();                       // a dev page: not registered
 *   scene.add(boat.group); if (boat.ropes) scene.add(boat.ropes);
 *   its registry piece.push(...boat.colliders);
 *   player.platforms.push((x, z) => boat.floorHeightAt(x, z));   // you can jump in
 *   game.onUpdate((dt) => boat.update(dt));
 *
 * `heading` is radians about +y (0 = bow toward −z, i.e. out to sea when moored at the south pier).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { waveHeight, seaDamp } from '@wildshard/engine/world/waves';
import type { MoverPose } from '@wildshard/engine/physics/mover';
import { BEAM, BOAT_CLEATS, BOAT_FLOOR, LENGTH, boat, boatColliders } from '../models/boat';

export interface BoatSpec {
  x: number; z: number;
  heading?: number;
  /** still-water level; the hull floats with its waterline here */
  waterY: number;
  /** world xz of posts to run mooring lines to (bow → first, stern → second) */
  moorTo?: { x: number; z: number }[];
}

const ROPE = new THREE.Color('#d2bd85');

export class Boat {
  /** the placed boat (the hull with its gear, the sail): posed on the swell every frame */
  group!: THREE.Object3D;
  /** its `place` (the Pier landing set's member, M12) */
  placed: Placed | null = null;
  colliders: Collider[] = [];
  private t = 0;
  /** The gameplay installer projects an admitted fixed-step script; dev model pages retain their preview clock. */
  moverDriven = false;
  private floorY: number;

  constructor(private sky: Sky, private spec: BoatSpec) { this.floorY = spec.waterY + BOAT_FLOOR; }

  /** the game's: placed and registered (piece `boat`, the catalog's Sailboat; its colliders ride it) */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's: the same boat, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const heading = this.spec.heading ?? 0;
    const placed = place(boat, [{ x: this.spec.x, y: this.spec.waterY, z: this.spec.z, ...(heading === 0 ? {} : { yaw: heading }) }], { ctx: modelContext(this.sky), draw: 'single', registry,
      piece: { id: 'boat', follows: 'copy', floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    const mat = lowPolyMaterial(this.sky);

    // mooring lines: bow / stern cleats → the posts, in world space (a separate static mesh so they don't bob)
    if (this.spec.moorTo?.length) {
      const ropeParts: THREE.BufferGeometry[] = [];
      const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
      const cleat = (lz: number, ly: number): THREE.Vector3 => new THREE.Vector3(this.spec.x + lz * sn, this.spec.waterY + ly, this.spec.z + lz * cs);
      const ends = [cleat(-LENGTH / 2 + 0.3, BOAT_CLEATS[0]?.y ?? 0.7), cleat(LENGTH / 2 - 0.3, BOAT_CLEATS[1]?.y ?? 0.7)];
      this.spec.moorTo.slice(0, 2).forEach((post, i) => {
        const a = ends[i];
        if (a === undefined) return;
        const b = new THREE.Vector3(post.x, this.spec.waterY + 1.9, post.z);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35; // sag
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const g = new THREE.TubeGeometry(curve, 8, 0.03, 4, false);
        g.deleteAttribute('uv'); g.deleteAttribute('normal');
        const ni = g.toNonIndexed(); const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { c[k * 3] = ROPE.r; c[k * 3 + 1] = ROPE.g; c[k * 3 + 2] = ROPE.b; }
        ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
        ropeParts.push(ni);
      });
      const ropeGeo = mergeGeometries(ropeParts, false);
      // each rope vertex remembers its rest position, which rope it is and how far along it lies (1 at the cleat, 0 at
      // the post), so update() can lift the cleat end with the boat on the swell and leave the post end tied
      const rp = ropeGeo.getAttribute('position');
      this.ropeRest = new Float32Array(rp.array);
      this.ropeW = new Float32Array(rp.count);
      this.ropeWhich = new Uint8Array(rp.count);
      const perRope = rp.count / ropeParts.length;
      for (let k = 0; k < rp.count; k++) {
        const which = Math.min(ropeParts.length - 1, Math.floor(k / perRope)), a = ends[which], post = this.spec.moorTo[which];
        if (a === undefined || post === undefined) continue;
        const bx = post.x, bz = post.z, dx = bx - a.x, dz = bz - a.z, len2 = dx * dx + dz * dz || 1;
        const t = Math.min(1, Math.max(0, ((rp.getX(k) - a.x) * dx + (rp.getZ(k) - a.z) * dz) / len2));
        this.ropeW[k] = 1 - t; this.ropeWhich[k] = which;
      }
      this.cleatZ = [-LENGTH / 2 + 0.3, LENGTH / 2 - 0.3];
      const ropes = new THREE.Mesh(ropeGeo, mat);
      ropes.castShadow = true;
      this.ropes = ropes;
    }
    // gunwales + bow / stern as thin walls: they keep you in the boat once you're in, and keep a swimmer out
    // of the hull; from the pier deck (above yTop) you step over them and drop onto the floor
    {
      const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h), yTop = this.spec.waterY + 0.8, yBottom = this.spec.waterY - 1.2;
      const wall = (lx: number, lz: number, hw: number, hd: number) => this.colliders.push({ x: this.spec.x + lx * cs + lz * sn, z: this.spec.z - lx * sn + lz * cs, hw, hd, rot: -h, yTop, yBottom });
      wall(-BEAM / 2, 0, 0.08, LENGTH / 2); wall(BEAM / 2, 0, 0.08, LENGTH / 2); wall(0, -LENGTH / 2, BEAM / 2, 0.08); wall(0, LENGTH / 2, BEAM / 2, 0.08);
    }
    return this;
  }

  /** triangles in the hull + sail meshes (the mooring lines aside) */
  get triangles(): number {
    let n = 0;
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) n += (o.geometry as THREE.BufferGeometry).getAttribute('position').count / 3; });
    return n;
  }

  /** PHYSICS P4: the boat's collision in its own (the group's LOCAL) frame — the model's colliders; they ride the swell */
  colliderLocalDescs(): ColliderDesc[] { return boatColliders(); }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls (the legacy boxes) and the floor
   * `floorHeightAt` describes, as real geometry: `colliderLocalDescs()` placed at the boat's rest pose.
   */
  colliderDescs(): ColliderDesc[] {
    const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
    const out: ColliderDesc[] = [];
    for (const d of this.colliderLocalDescs()) {
      if (d.kind !== 'box') continue; // the local set is boxes only
      out.push({ ...d, x: this.spec.x + d.x * cs + d.z * sn, y: this.spec.waterY + d.y, z: this.spec.z - d.x * sn + d.z * cs, yaw: h + (d.yaw ?? 0) });
    }
    return out;
  }

  /** static mesh with the mooring lines (world space) — add it to the scene beside `group` */
  ropes: THREE.Mesh | null = null;

  /** the boat's floor if (x, z) is inside the hull */
  floorHeightAt(x: number, z: number): number | undefined {
    const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * sn + dz * cs, lx = dx * cs - dz * sn;
    if (Math.abs(lz) > LENGTH / 2 - 0.3 || Math.abs(lx) > BEAM / 2 * 0.8) return undefined;
    return this.floorY;
  }

  private ropeRest: Float32Array | null = null;
  private ropeW = new Float32Array(0);
  private ropeWhich = new Uint8Array(0);
  private cleatZ = [0, 0];
  private cleatDy = [0, 0];

  /**
   * Ride the shared swell (W3, src/engine/world/waves.ts — the same Gerstner sum the ocean shader draws): heave from the wave
   * height under the hull, pitch from 2 m fore / aft, roll from 2 m to either side; the mooring lines' cleat ends follow.
   */
  update(dt: number): void {
    this.t += dt;
    const g = this.group, x = this.spec.x, z = this.spec.z, w = this.spec.waterY;
    const damp = seaDamp(w - heightAt(x, z));
    const h = this.spec.heading ?? 0, fx = -Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);   // bow (local −z), starboard (+x)
    const hFore = waveHeight(x + fx * 2, z + fz * 2, undefined, damp), hAft = waveHeight(x - fx * 2, z - fz * 2, undefined, damp);
    const hStar = waveHeight(x + sx * 2, z + sz * 2, undefined, damp), hPort = waveHeight(x - sx * 2, z - sz * 2, undefined, damp);
    g.rotation.order = 'YXZ';
    g.position.y = w + waveHeight(x, z, undefined, damp);
    g.rotation.x = Math.atan2(hFore - hAft, 4);            // bow up when the crest is under it
    g.rotation.z = Math.atan2(hStar - hPort, 4);           // port side up when the crest is to port
    this.updateMoorings();
  }

  /** Presentation projection only: the script's published pose already drives collision before the physics step. */
  setMoverPose(pose: MoverPose): void {
    this.group.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.group.rotation.set(pose.euler.x, pose.euler.y, pose.euler.z, 'YXZ');
    this.updateMoorings();
  }

  private updateMoorings(): void {
    const g = this.group, w = this.spec.waterY;
    // the mooring lines: lift each rope's cleat end with the hull (heave + pitch at that cleat), the post end stays put
    const rest = this.ropeRest;
    if (this.ropes && rest) {
      const heave = g.position.y - w, s = Math.sin(g.rotation.x);
      for (let i = 0; i < 2; i++) this.cleatDy[i] = heave - (this.cleatZ[i] ?? 0) * s;
      const pos = this.ropes.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let k = 0; k < this.ropeW.length; k++) arr[k * 3 + 1] = (rest[k * 3 + 1] ?? 0) + (this.cleatDy[this.ropeWhich[k] ?? 0] ?? 0) * (this.ropeW[k] ?? 0);
      pos.needsUpdate = true;
    }
  }
}
