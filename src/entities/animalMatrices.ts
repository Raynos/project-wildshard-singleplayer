import * as THREE from 'three';

/**
 * The animals' group, whose world-matrix pass skips what did not change (E142 aggro-perf).
 *
 * three recomputes every object's world matrix every frame (`scene.updateMatrixWorld` in `renderer.render`), visible or
 * not: ~170 animals × ~20 bones = ~3 500 matrix composes + multiplies, the largest single item of Pine Hollow's frame on
 * the CPU (a Performance trace at 4× CPU, the Imperial Bull fight: 2.5 ms of the frame's ~17 ms; the calm spot 1.5 ms).
 * Most of those animals stand past 140 m, where Animal.update leaves the skeleton's pose as it was (the far LOD moves
 * only the root), and many of them stand still — so their bones' world matrices come out the same, frame after frame.
 *
 * An animal's subtree is skipped when ALL of these hold, so the matrices it keeps are exactly what the pass would compute:
 *   - its pose was left frozen this frame (`Animal.poseFrozen`: the far LOD, not a ragdoll, not posed);
 *   - its root's local matrix (position, rotation, the fade's scale) is the one of its last full update;
 *   - the group's world matrix is too;
 *   - it has not been hit since (a stuck bolt), and nothing was attached to / detached from its subtree (three's
 *     childadded / childremoved events on every node of it).
 * The hitboxes (CreatureBodies.sync reads the head / body bones' matrixWorld) and the far herd's batch (it skins with the
 * rig's own bones) read the same, still-true matrices.
 */
/** what the group needs of an animal (src/entities/Animal.ts) */
export interface MatrixOwner { readonly mesh: THREE.Object3D; readonly poseFrozen: boolean; readonly lastHitT: number }
interface Keep { root: Float64Array; parent: Float64Array; dirty: boolean; hitT: number }

function same(a: ArrayLike<number>, b: Float64Array): boolean {
  for (let i = 0; i < 16; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class AnimalGroup extends THREE.Group {
  private readonly owner = new WeakMap<THREE.Object3D, MatrixOwner>();
  private readonly keep = new WeakMap<MatrixOwner, Keep>();
  /** subtrees skipped / updated in the last pass (tests, the bench) */
  readonly last = { skipped: 0, updated: 0 };

  /** `a.mesh` is (or will be) a child of this group: its subtree may be skipped */
  own(a: MatrixOwner): void { this.owner.set(a.mesh, a); this.watch(a.mesh); }

  // anything attached to / detached from an animal's subtree (a stuck bolt, a kit, the fur shells) → its next pass is full
  private readonly onAdded = (e: { child: THREE.Object3D; target: THREE.Object3D }): void => { this.dirtyFrom(e.target); this.watch(e.child); };
  private readonly onRemoved = (e: { target: THREE.Object3D }): void => { this.dirtyFrom(e.target); };
  private watch(o: THREE.Object3D): void {
    if (!o.hasEventListener('childadded', this.onAdded)) { o.addEventListener('childadded', this.onAdded); o.addEventListener('childremoved', this.onRemoved); }
    for (const c of o.children) this.watch(c);
  }
  private dirtyFrom(o: THREE.Object3D): void {
    for (let p: THREE.Object3D | null = o; p !== null; p = p.parent) {
      const a = this.owner.get(p);
      if (a !== undefined) { const k = this.keep.get(a); if (k !== undefined) k.dirty = true; return; }
    }
  }

  override updateMatrixWorld(force = false): void {
    // the group itself, as Object3D.updateMatrixWorld does it
    if (this.matrixAutoUpdate) this.updateMatrix();
    let down = force;
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate) {
        if (this.parent === null) this.matrixWorld.copy(this.matrix);
        else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      down = true;
    }
    const pw = this.matrixWorld.elements;
    let skipped = 0, updated = 0;
    for (const c of this.children) {
      const a = this.owner.get(c);
      if (a === undefined) { c.updateMatrixWorld(down); continue; }
      let k = this.keep.get(a);
      if (a.poseFrozen && k !== undefined) {
        if (c.matrixAutoUpdate) c.updateMatrix();
        if (!k.dirty && k.hitT === a.lastHitT && same(c.matrix.elements, k.root) && same(pw, k.parent)) { skipped++; continue; }
      }
      c.updateMatrixWorld(down);
      updated++;
      if (k === undefined) { k = { root: new Float64Array(16), parent: new Float64Array(16), dirty: false, hitT: 0 }; this.keep.set(a, k); }
      k.root.set(c.matrix.elements); k.parent.set(pw); k.dirty = false; k.hitT = a.lastHitT;
    }
    this.last.skipped = skipped; this.last.updated = updated;
  }
}
