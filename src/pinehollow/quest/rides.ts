/**
 * Pine Hollow's two rides (PINE-HOLLOW-REMASTER PH-C1 beat 3, PH-C8 the canoe secret), on the landmarks PH-B3 built:
 *
 *   ZipRide   "[E] Ride the zipline" on the lookout's launch jetty: a trolley on the cable (PineLandmarks' sagging chord,
 *             1.2 % of the span) carries you 197 m down to the landing in the Hollow — gravity along the wire minus drag
 *             (Driftwood's Zipline.ts rule, 16 m/s tops), the camera rolls a little in the wind, you drop the last metre
 *             onto the landing's deck. The cable and both decks are the landmarks'; this only adds the trolley (1 draw).
 *   CanoeRide "[E] Paddle to the islet" at the canoe on the pond's W shore: the canoe slides off the bank (the landmarks'
 *             drawn-up canoe is hidden while it is out), 20 m across the still water to the islet, you step ashore;
 *             "[E] Paddle back" from the islet's beach. 1 draw while out.
 *
 * While either ride runs it owns the player (`player.carried`: the fixed step leaves the body alone).
 */
import * as THREE from 'three';
import type { Sky } from '../../world/Sky';
import type { Interactable } from '../../world/Cabin';
import { POND } from '../../chunks/pineHollowLayout';
import { npcMaterial, PartKit } from './npcFigure';

interface Rider { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number; pitch: number; carried: boolean }

const G = 9.8, DRAG = 0.012, VMAX = 16, HANG = 3.15, SAG = 0.012;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class ZipRide {
  readonly prompt: Interactable;
  readonly trolley: THREE.Mesh;
  onRide?: (on: boolean) => void;
  private riding = false;
  private s = 0; private v = 0; private len: number; private sag: number;
  private dir = new THREE.Vector3();
  private roll = 0;

  constructor(sky: Sky, private readonly top: THREE.Vector3, private readonly bottom: THREE.Vector3, launch: THREE.Vector3, private readonly landing: THREE.Vector3) {
    this.len = top.distanceTo(bottom);
    this.sag = this.len * SAG;
    this.dir.subVectors(bottom, top).setY(0).normalize();
    const k = new PartKit();
    k.add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), '#3a3d42', 0, 0, 0, 0, 0, Math.PI / 2);
    k.add(new THREE.BoxGeometry(0.07, 0.24, 0.22), '#7a2e22', 0, -0.07, 0);
    for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 5), '#b9a57a', sx * 0.15, -0.46, 0, 0, 0, sx * 0.45);
    k.add(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 6), '#4a3522', 0, -0.76, 0, 0, 0, Math.PI / 2);
    this.trolley = new THREE.Mesh(k.finish(), npcMaterial(sky));
    this.trolley.castShadow = true;
    this.trolley.name = 'zip-trolley';
    this.park();
    const riding = (): boolean => this.riding;
    this.prompt = { position: new THREE.Vector3(launch.x, launch.y + 1.1, launch.z), get radius() { return riding() ? 0 : 2.3; }, label: 'Ride the zipline', onInteract: () => { this.start(); } };
  }

  get isRiding(): boolean { return this.riding; }

  /** the cable at arc position s */
  at(s: number, out: THREE.Vector3): THREE.Vector3 {
    const t = THREE.MathUtils.clamp(s / this.len, 0, 1);
    return out.lerpVectors(this.top, this.bottom, t).setY(this.top.y + (this.bottom.y - this.top.y) * t - 4 * this.sag * t * (1 - t));
  }

  private park(): void {
    this.at(0.7, this.trolley.position);
    this.trolley.rotation.set(0, Math.atan2(this.dir.x, this.dir.z) + Math.PI / 2, 0);
  }

  start(): void {
    if (this.riding) return;
    this.riding = true; this.s = 0.7; this.v = 2.5; this.roll = 0;
    this.onRide?.(true);
  }

  /** per frame, after the player's own update: while riding the cable owns the position */
  update(dt: number, p: Rider, camera: THREE.Camera): void {
    if (!this.riding) return;
    const slope = -(this.at(this.s + 0.5, _a).y - this.at(this.s, _b).y) / 0.5;
    this.v = Math.min(VMAX, Math.max(1.5, this.v + (G * slope * 0.9 - DRAG * this.v * this.v) * dt));
    this.s += this.v * dt;
    this.at(this.s, this.trolley.position);
    this.trolley.rotation.z = Math.sin(this.s * 0.7) * 0.05;
    p.carried = true;
    p.position.copy(this.trolley.position); p.position.y -= HANG;
    p.velocity.set(0, 0, 0);
    // the wind on the wire: a slow roll that grows with the speed
    this.roll += dt;
    camera.rotation.z += Math.sin(this.roll * 1.3) * 0.012 * (this.v / VMAX);
    if (this.s >= this.len - 2.0) {
      this.riding = false;
      p.carried = false;
      p.position.set(this.landing.x - this.dir.x * 0.6, Math.max(p.position.y, this.landing.y + 0.05), this.landing.z - this.dir.z * 0.6);
      p.velocity.set(this.dir.x * 2.5, 0, this.dir.z * 2.5);
      this.park();
      this.onRide?.(false);
    }
  }
}

/** the canoe: a lathed birch-bark hull, two thwarts, a paddle across them */
function canoeGeometry(): THREE.BufferGeometry {
  const k = new PartKit();
  const hull = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  k.add(hull, '#8a5a34', 0, 0.33, 0, 0, 0, 0, 0.46, 0.34, 2.3);
  k.add(new THREE.TorusGeometry(1, 0.035, 4, 24), '#5b3a22', 0, 0.33, 0, Math.PI / 2, 0, 0, 0.46, 2.3, 1);
  for (const z of [-0.8, 0.8]) k.add(new THREE.BoxGeometry(0.8, 0.04, 0.08), '#6e4a2c', 0, 0.28, z);
  k.add(new THREE.BoxGeometry(0.06, 0.03, 1.5), '#a07a4e', 0.12, 0.33, 0.1, 0, 0.2, 0);
  return k.finish();
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
    this.mesh = new THREE.Mesh(canoeGeometry(), npcMaterial(sky));
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
