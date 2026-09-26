// The build context every world module writes into: named kits (one merged mesh each), instance lists, sign quads,
// the grapple's dragon hooks and the minimap's floor plan.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { Kit } from './kit';
import type { Emitter } from './emitters';
import { Dressing } from './facade/grammar';
import { KitX } from './hero/kitx';
import type { SignBuilder } from './signs';
import { Rng } from './util';
import { WELL, Y0 } from './layout';

/** instanced kit pieces (dressing.ts builds their geometry) */
export type Piece = 'balcony' | 'cage' | 'plant' | 'awning' | 'laundry' | 'shack' | 'tank' | 'lightbox' | 'pipe' | 'shutter';

export interface Instance { m: Matrix4; c: Color }

const WHITE = new Color(1, 1, 1);
const ZAX = new Vector3(0, 0, 1);

export interface MapRect { x0: number; z0: number; x1: number; z1: number; kind: 'block' | 'street' | 'well' | 'plaza' | 'green' | 'gate' }

export class Ctx {
  readonly kits = new Map<string, Kit>();
  readonly alphaKits = new Map<string, Kit>();
  /** the hero lab's curved pieces, merged with the kit of the same name */
  readonly kitxs = new Map<string, KitX>();
  /** the TRELLIS crowd: walkers (umbrellas) and mahjong sitters, instanced by main.ts */
  readonly walkers: Matrix4[] = [];
  readonly sitters: Matrix4[] = [];
  /** kits drawn into the wet-ground reflection */
  readonly reflective = new Set<string>();
  readonly lanterns: Matrix4[] = [];
  readonly acs: Matrix4[] = [];
  readonly hooks: Vector3[] = [];
  readonly map: MapRect[] = [];
  readonly steam: Vector3[] = [];
  /** lit shopfronts and other glowing fronts (streak cards + spill) */
  readonly emitters: Emitter[] = [];
  /** the facade lab's Kowloon dressing for every tower wall and the Well (one batch: draws count piece types) */
  readonly fd = new Dressing();
  /** instanced dressing, keyed piece@region so the deep Well's pieces cull as one */
  readonly inst = new Map<string, Instance[]>();
  readonly rng = new Rng(9);

  constructor(readonly signs: SignBuilder) {}

  kit(name: string, reflective = false): Kit {
    let k = this.kits.get(name);
    if (k === undefined) { k = new Kit(); this.kits.set(name, k); }
    if (reflective) this.reflective.add(name);
    return k;
  }

  kitx(name: string): KitX {
    let k = this.kitxs.get(name);
    if (k === undefined) { k = new KitX(); this.kitxs.set(name, k); }
    return k;
  }

  alpha(name: string): Kit {
    let k = this.alphaKits.get(name);
    if (k === undefined) { k = new Kit(); this.alphaKits.set(name, k); }
    return k;
  }

  lantern(x: number, y: number, z: number, s = 1, rot = 0): void {
    const m = new Matrix4().makeRotationY(rot);
    m.scale(new Vector3(s, s, s));
    m.setPosition(x, y, z);
    this.lanterns.push(m);
  }

  /** place a kit piece: its local +z faces `n` (a wall's outward normal), origin at `at`, scaled by `s` */
  put(piece: Piece, at: Vector3, n: Vector3, s: Vector3, color: Color = WHITE): void {
    const q = new Quaternion().setFromUnitVectors(ZAX, new Vector3(n.x, 0, n.z).normalize());
    const m = new Matrix4().compose(at, q, s);
    const inWell = at.x > WELL.x0 - 1 && at.x < WELL.x1 + 1 && at.z > WELL.z0 - 1 && at.z < WELL.z1 + 1;
    const region = inWell ? (at.y < Y0 - 70 ? 'deep' : 'well') : 'town';
    const key = `${piece}@${region}`;
    let list = this.inst.get(key);
    if (list === undefined) { list = []; this.inst.set(key, list); }
    list.push({ m, c: color.clone() });
  }

  ac(x: number, y: number, z: number, rotY: number): void {
    const m = new Matrix4().makeRotationY(rotY);
    m.setPosition(x, y, z);
    this.acs.push(m);
  }
}
