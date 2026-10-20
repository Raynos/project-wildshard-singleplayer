import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ReinRibbonFrame } from '@wildshard/format/riding';
import { ReinRibbon } from '@wildshard/game/riding/reins';
import { nalatiReinRows } from '../runtime/reins';

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
/** Native skeleton observations only; the riding host draws the admitted strap rows. */
export class Reins {
  private readonly ribbon: ReinRibbon;
  private readonly rows = nalatiReinRows();
  private readonly frame: ReinRibbonFrame = { yaw: 0, drop: false, head: [0, 0, 0], crest: [0, 0, 0], muzzle: [0, 0, 0], withers: [0, 0, 0] };
  private readonly muzzleLocal = new WeakMap<Animal, THREE.Vector3>();
  get group(): THREE.Group { return this.ribbon.group; }
  constructor(camera: THREE.PerspectiveCamera, scope?: Scope) { this.ribbon = new ReinRibbon(camera, this.rows, scope); }
  /** the muzzle in the head bone's frame: of the vertices the head bone moves most, the one farthest from it (bind pose:
   *  bone⁻¹ · bindMatrix · v) — found in the horse's own mesh, whichever horse it is */
  private muzzleOf(a: Animal): THREE.Vector3 | null {
    const rows = this.rows;
    const hit = this.muzzleLocal.get(a);
    if (hit !== undefined) return hit;
    const mesh = a.mesh, sk = mesh.skeleton, head = sk.getBoneByName(rows.anchors.head);
    if (head === undefined) return null;   // not a horse rig
    const hi = sk.bones.indexOf(head), inv = sk.boneInverses[hi];
    if (inv === undefined) return null;
    const g = mesh.geometry, pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
    _m.multiplyMatrices(inv, mesh.bindMatrix);
    let best: THREE.Vector3 | null = null, bd = -1;
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === hi) w += sw.getComponent(i, c);
      if (w < rows.anchors.minWeight) continue;
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
      const d = _v.lengthSq();
      if (d > bd) { bd = d; best = (best ?? new THREE.Vector3()).copy(_v); }
    }
    if (best === null) return null;
    this.muzzleLocal.set(a, best);
    return best;
  }

  update(dt: number, horse: Animal | null, on: boolean, drop: boolean): void {
    const rows = this.rows;
    if (!on || horse === null) { this.ribbon.update(dt, null); return; }
    const muzzle = this.muzzleOf(horse), skeleton = horse.mesh.skeleton;
    const head = skeleton.getBoneByName(rows.anchors.head), crest = skeleton.getBoneByName(rows.anchors.crest), body = skeleton.getBoneByName(rows.anchors.body);
    if (muzzle === null || head === undefined || crest === undefined || body === undefined) { this.ribbon.group.visible = false; return; }
    horse.mesh.updateMatrixWorld(true);
    const frame = this.frame; frame.drop = drop; frame.yaw = horse.yaw;
    _v.setFromMatrixPosition(head.matrixWorld).toArray(frame.head);
    _v.setFromMatrixPosition(crest.matrixWorld).toArray(frame.crest);
    _v.copy(muzzle).applyMatrix4(head.matrixWorld).toArray(frame.muzzle);
    _v.fromArray(rows.anchors.withers).applyMatrix4(body.matrixWorld).toArray(frame.withers);
    this.ribbon.update(dt, frame);
  }
}
