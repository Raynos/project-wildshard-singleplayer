// The build context every world module writes into: named kits (one merged mesh each), instance lists, sign quads,
// the grapple's dragon hooks and the minimap's floor plan.
import { Matrix4, Vector3 } from 'three';
import { Kit } from './kit';
import type { SignBuilder } from './signs';
import { Rng } from './util';

export interface MapRect { x0: number; z0: number; x1: number; z1: number; kind: 'block' | 'street' | 'well' | 'plaza' | 'green' | 'gate' }

export class Ctx {
  readonly kits = new Map<string, Kit>();
  readonly alphaKits = new Map<string, Kit>();
  /** kits drawn into the wet-ground reflection */
  readonly reflective = new Set<string>();
  readonly lanterns: Matrix4[] = [];
  readonly acs: Matrix4[] = [];
  readonly hooks: Vector3[] = [];
  readonly map: MapRect[] = [];
  readonly steam: Vector3[] = [];
  readonly rng = new Rng(9);

  constructor(readonly signs: SignBuilder) {}

  kit(name: string, reflective = false): Kit {
    let k = this.kits.get(name);
    if (k === undefined) { k = new Kit(); this.kits.set(name, k); }
    if (reflective) this.reflective.add(name);
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

  ac(x: number, y: number, z: number, rotY: number): void {
    const m = new Matrix4().makeRotationY(rotY);
    m.setPosition(x, y, z);
    this.acs.push(m);
  }
}
