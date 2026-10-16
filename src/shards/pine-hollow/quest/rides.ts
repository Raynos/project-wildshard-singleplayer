import * as THREE from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { POND } from '../data/layout';
import { codePart } from '../runtime/world/codeParts';
import { npcMaterial } from '../runtime/models/people';
import { MoverMechanic } from '@wildshard/engine/sim/moverMotion';
import type { ScriptEntity } from '@wildshard/engine/script/effects';

interface Rider { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number; pitch: number; carried: boolean }

export class CanoeRide {
  readonly mesh: THREE.Mesh;
  /** "[E] Paddle to the islet" at the drawn-up canoe; "[E] Paddle back" on the islet's beach */
  readonly out: Interactable;
  readonly back: Interactable;
  onRide?: (on: boolean, arrived: 'islet' | 'shore' | null) => void;
  private readonly motion: MoverMechanic;
  private state: ScriptEntity = { id: 1, name: 'canoe', position: [0, 0, 0], fields: {}, frozen: false, interactive: true };
  private command = 0;

  constructor(sky: Sky, shore: THREE.Vector3, beach: THREE.Vector3, shoreStand: THREE.Vector3, isletStand: THREE.Vector3) {
    const at = (p: THREE.Vector3): [number, number, number] => [p.x, p.y, p.z];
    this.motion = new MoverMechanic({ kind: 'transit', from: at(shore), to: at(beach), landings: [at(shoreStand), at(isletStand)],
      seconds: 9, water: POND.level + 0.02, bankRamp: 8, seat: -0.45, yaw: Math.PI, bob: [1.9, 0.03], pitch: [1.3, 0.02], roll: [2.1, 0.035, 1] });
    this.mesh = new THREE.Mesh(codePart('canoe'), npcMaterial(sky)); // the birch-bark hull, thwarts and paddle, baked offline
    this.mesh.castShadow = true; this.mesh.visible = false; this.mesh.name = 'canoe-ride';
    const busy = (): boolean => this.isRiding;
    this.out = { position: new THREE.Vector3(shore.x, shore.y + 0.8, shore.z), get radius() { return busy() ? 0 : 2.6; }, label: 'Paddle to the islet', onInteract: () => { this.start(1); } };
    this.back = { position: new THREE.Vector3(isletStand.x, isletStand.y + 0.9, isletStand.z), get radius() { return busy() ? 0 : 2.4; }, label: 'Paddle back to the shore', onInteract: () => { this.start(-1); } };
  }

  get isRiding(): boolean { return this.command !== 0 || this.state.fields[6] === 1 || this.state.fields[6] === 0.5; }

  private start(dir: number): void {
    if (this.isRiding) return;
    this.command = dir > 0 ? 1 : 2;
    this.mesh.visible = true;
    this.onRide?.(true, null);
  }

  /** the ride lasts DUR s: pushed off, paddled across, grounded on the far side */
  update(dt: number, t: number, p: Rider): void {
    if (!this.isRiding) return;
    const next = this.motion.step(this.state, { tick: 0, dt, time: t, action: this.command, permission: 0 }), carry = next.carry;
    if (carry === undefined) throw new Error('Missing admitted canoe carry');
    this.command = 0; this.state = next.entity;
    this.mesh.position.set(...next.entity.position); this.mesh.visible = carry.visible;
    this.mesh.rotation.set(next.entity.fields[1] ?? 0, next.entity.fields[2] ?? 0, next.entity.fields[3] ?? 0);
    p.carried = carry.riding; p.position.set(...carry.position);
    p.velocity.set(0, 0, 0);
    if (!carry.riding) {
      if (carry.yaw !== undefined) p.yaw = carry.yaw;
      this.onRide?.(false, carry.arrived === 1 ? 'islet' : 'shore');
    }
  }
}
