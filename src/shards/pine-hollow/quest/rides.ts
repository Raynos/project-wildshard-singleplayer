import { ZiplineDriver, ZiplineTrolley } from '@wildshard/sdk/movers';
import { ZIPLINE, ZIP_RIDE } from '../data/zipline';
/**
 * Pine Hollow's two rides (PINE-HOLLOW-REMASTER PH-C1 beat 3, PH-C8 the canoe secret), on the landmarks PH-B3 built:
 *
 *   ZipRide   "[E] Ride the zipline" on the lookout's launch jetty: a trolley on the cable (PineLandmarks' sagging chord,
 *             1.2 % of the span) carries you 197 m down to the landing in the Hollow on the wire's law (zipWire.ts, the
 *             headless quest's too), the camera rolls a little in the wind, you drop the last metre onto the landing's
 *             deck. The cable and both decks are the landmarks'; this only adds the trolley (1 draw).
 *   CanoeRide "[E] Paddle to the islet" at the canoe on the pond's W shore: the canoe slides off the bank (the landmarks'
 *             drawn-up canoe is hidden while it is out), 20 m across the still water to the islet, you step ashore;
 *             "[E] Paddle back" from the islet's beach. 1 draw while out.
 *
 * While either ride runs it owns the player (`player.carried`: the fixed step leaves the body alone).
 */
import * as THREE from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { POND } from '../data/layout';
import { codePart } from '../world/codeParts';
import { npcMaterial } from '../runtime/models/people';

interface Rider { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number; pitch: number; carried: boolean }

export class ZipRide {
  readonly prompt: Interactable;
  readonly trolley: THREE.Mesh;
  onRide?: (on: boolean) => void;
  private readonly wire: ZiplineDriver;
  private readonly carriage: ZiplineTrolley;
  private roll = 0;

  constructor(sky: Sky, top: THREE.Vector3, bottom: THREE.Vector3, launch: THREE.Vector3, landing: THREE.Vector3) {
    this.wire = new ZiplineDriver({ ...ZIPLINE, top, bottom }, () => undefined, ZIP_RIDE, landing);
    this.trolley = new THREE.Mesh(codePart('zip-trolley'), npcMaterial(sky)); // baked offline (../generators/codeParts.ts)
    this.trolley.castShadow = true;
    this.trolley.name = 'zip-trolley';
    this.carriage = new ZiplineTrolley(this.wire, ZIP_RIDE.start, this.trolley, { position: new THREE.Vector3(launch.x, launch.y + 1.1, launch.z), radius: 2.3, label: 'Ride the zipline' }, () => this.wire.isRiding, () => { this.start(); });
    this.prompt = this.carriage.prompt;
  }

  get isRiding(): boolean { return this.wire.isRiding; }

  start(): void {
    if (this.wire.isRiding) return;
    this.wire.start(); this.roll = 0;
    this.onRide?.(true);
  }

  /** per frame, after the player's own update: while riding the cable owns the position */
  update(dt: number, p: Rider, camera: THREE.Camera): void {
    if (!this.wire.isRiding) return;
    const holding = this.wire.update(dt, p);
    this.carriage.follow(this.wire.distance);
    p.carried = holding;
    // the wind on the wire: a slow roll that grows with the speed
    this.roll += dt;
    camera.rotation.z += Math.sin(this.roll * 1.3) * 0.012 * (this.wire.speed / ZIPLINE.maxSpeed);
    if (!holding) {
      this.carriage.park();
      this.onRide?.(false);
    }
  }
}

export class CanoeRide {
  readonly mesh: THREE.Mesh;
  /** "[E] Paddle to the islet" at the drawn-up canoe; "[E] Paddle back" on the islet's beach */
  readonly out: Interactable;
  readonly back: Interactable;
  onRide?: (on: boolean, arrived: 'islet' | 'shore' | null) => void;
  private t = -1;
  private dir = 1;
  private readonly water = POND.level;

  constructor(sky: Sky, private readonly shore: THREE.Vector3, private readonly beach: THREE.Vector3, private readonly shoreStand: THREE.Vector3, private readonly isletStand: THREE.Vector3) {
    this.mesh = new THREE.Mesh(codePart('canoe'), npcMaterial(sky)); // the birch-bark hull, thwarts and paddle, baked offline
    this.mesh.castShadow = true; this.mesh.visible = false; this.mesh.name = 'canoe-ride';
    const busy = (): boolean => this.t >= 0;
    this.out = { position: new THREE.Vector3(shore.x, shore.y + 0.8, shore.z), get radius() { return busy() ? 0 : 2.6; }, label: 'Paddle to the islet', onInteract: () => { this.start(1); } };
    this.back = { position: new THREE.Vector3(isletStand.x, isletStand.y + 0.9, isletStand.z), get radius() { return busy() ? 0 : 2.4; }, label: 'Paddle back to the shore', onInteract: () => { this.start(-1); } };
  }

  get isRiding(): boolean { return this.t >= 0; }

  private start(dir: number): void {
    if (this.t >= 0) return;
    this.t = 0; this.dir = dir;
    this.mesh.visible = true;
    this.onRide?.(true, null);
  }

  /** the ride lasts DUR s: pushed off, paddled across, grounded on the far side */
  update(dt: number, t: number, p: Rider): void {
    if (this.t < 0) return;
    const DUR = 9;
    this.t += dt;
    const u = Math.min(1, this.t / DUR), e = u * u * (3 - 2 * u);
    const from = this.dir > 0 ? this.shore : this.beach, to = this.dir > 0 ? this.beach : this.shore;
    const x = from.x + (to.x - from.x) * e, z = from.z + (to.z - from.z) * e;
    // on the water between the two beaches, riding up onto each bank at the ends
    const onWater = Math.min(1, Math.min(u, 1 - u) * 8);
    const bank = from.y + (to.y - from.y) * e;
    const y = bank + (this.water + 0.02 - bank) * onWater + Math.sin(t * 1.9) * 0.03 * onWater;
    const heading = Math.atan2(to.x - from.x, to.z - from.z);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.set(Math.sin(t * 1.3) * 0.02 * onWater, heading, Math.sin(t * 2.1 + 1) * 0.035 * onWater);
    p.carried = true;
    p.position.set(x, y - 0.45, z);   // seated low in the hull
    p.velocity.set(0, 0, 0);
    if (u >= 1) {
      this.t = -1;
      p.carried = false;
      const stand = this.dir > 0 ? this.isletStand : this.shoreStand;
      p.position.copy(stand);
      p.yaw = this.dir > 0 ? heading + Math.PI : heading + Math.PI;
      this.mesh.visible = this.dir > 0;   // it waits on the islet's beach; back on the shore the drawn-up canoe returns
      if (this.dir > 0) this.mesh.position.set(this.beach.x, this.beach.y, this.beach.z);
      this.onRide?.(false, this.dir > 0 ? 'islet' : 'shore');
    }
  }
}
