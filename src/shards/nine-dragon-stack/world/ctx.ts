// The build context every world module writes into: named kits (one merged mesh each), instance lists, sign quads,
// the grapple's dragon hooks and the minimap's floor plan.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { Kit } from './kit';
import type { Emitter } from '@wildshard/sdk/looks/vertexSpill';
import { Dressing } from './facade/dressing';
import { KitX } from './hero/kitx';
import { KitSet } from '@wildshard/sdk/kit/kitSet';
import type { DrawnCopy } from '@wildshard/sdk/kit/drawnInto';
import type { SignSink } from '../look/signs';
import { Rng } from '@wildshard/engine/core/rng';
import { WELL, Y0 } from '../layout';

/** instanced kit pieces (dressing.ts builds their geometry) */
export type Piece = 'balcony' | 'cage' | 'plant' | 'awning' | 'laundry' | 'shack' | 'tank' | 'lightbox' | 'pipe' | 'shutter';

export interface Instance { m: Matrix4; c: Color }

const WHITE = new Color(1, 1, 1);
const ZAX = new Vector3(0, 0, 1);

/** a model drawn into a kit (E306 M4, models/inKit.ts): the world records where each copy stands and registers them on the
 *  kit's mesh once it is built (world/inKit.ts, @wildshard/sdk/kit/drawnInto) */
export type InKit = DrawnCopy<Kit>;

export interface MapRect { x0: number; z0: number; x1: number; z1: number; kind: 'block' | 'street' | 'well' | 'plaza' | 'green' | 'gate' }

/** the build context: the named kits (the SDK's kit set: `kit`, `alpha`, `kitx`, `far`, `cell`) and the layout's records */
export class Ctx extends KitSet<Kit, KitX> {
  /** the TRELLIS crowd: walkers (umbrellas) and mahjong sitters, instanced by main.ts */
  readonly walkers: Matrix4[] = [];
  readonly sitters: Matrix4[] = [];
  readonly lanterns: Matrix4[] = [];
  readonly acs: Matrix4[] = [];
  readonly hooks: Vector3[] = [];
  /** placement records for the TRELLIS casting over selected procedural brass hook brackets */
  readonly hookMounts: { ring: Vector3; out: Vector3 }[] = [];
  /** the models drawn into kits, where they stand (see InKit) */
  readonly inKit: InKit[] = [];
  readonly map: MapRect[] = [];
  readonly steam: Vector3[] = [];
  /** lit shopfronts and other glowing fronts (streak cards + spill) */
  readonly emitters: Emitter[] = [];
  /** the facade lab's Kowloon dressing for every tower wall and the Well (one batch: draws count piece types) */
  readonly fd = new Dressing();
  /** instanced dressing, keyed piece@region so the deep Well's pieces cull as one */
  readonly inst = new Map<string, Instance[]>();
  readonly rng = new Rng(9);

  /** where the layout's signs go (look/signs.ts) */
  readonly signs: SignSink;

  constructor(signs: SignSink) {
    super(() => new Kit(), () => new KitX());
    this.signs = signs;
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
