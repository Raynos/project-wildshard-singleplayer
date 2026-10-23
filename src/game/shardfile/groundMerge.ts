/**
 * Tile streaming P1 (draws): a splat ground's resident tiles drawn as one merged mesh per material, so a tiled ground takes
 * no more draws than the whole one. Each tile's ground mesh joins its merge hidden; the merge rebuilds (once per task, on a
 * microtask) whenever a tile arrives, leaves or (a coarse tile) changes which of its quadrants fine tiles cover: those
 * quadrants' triangles (by centroid) are left out, as the coarse tile mask's fragment test would hide them.
 *
 *   const merge = groundMerge(parent, material);
 *   const hide = merge.add(mesh, tileScope, { x: 1, z: 2 });   // a coarse tile; the fine tiles over it: hide(new Set([0, 3]))
 *
 * Positions go into the parent's space; the merged mesh carries the attributes every member has (a coarse tile's vertex
 * colours, say, are left out when a fine tile has none). The merged mesh receives shadow and never casts (as the tiles), and leaves with the
 * last member.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, type Material, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';

const HALF = 250, COARSE = 125;
interface Member { readonly mesh: Mesh; readonly corner: { readonly x: number; readonly z: number } | null; hidden: ReadonlySet<number> }

export class GroundMerge {
  private readonly members = new Map<Mesh, Member>();
  private merged: Mesh | null = null;
  private queued = false;
  /** `onRebuild`: each new merged mesh, before it draws (its shadow flags, render order or a terrain's mesh slot) */
  constructor(private readonly parent: Object3D, private readonly material: Material, private readonly name: string, private readonly onRebuild?: (mesh: Mesh) => void) {}

  /** The tile's ground `mesh` joins (hidden itself) until `scope` ends; `coarse` (its coarse tile) returns the quadrant setter. */
  add(mesh: Mesh, scope: Scope, coarse?: { readonly x: number; readonly z: number }): (hidden: ReadonlySet<number>) => void {
    const member: Member = { mesh, corner: coarse === undefined ? null : { x: -HALF + coarse.x * COARSE, z: -HALF + coarse.z * COARSE }, hidden: new Set() };
    mesh.visible = false; this.members.set(mesh, member); this.queue();
    scope.onDispose(() => { if (this.members.delete(mesh)) this.queue(); });
    return (hidden) => { member.hidden = new Set(hidden); this.queue(); };
  }

  /** How many members the merge draws in its one mesh (tests and the overlay read it). */
  get size(): number { return this.members.size; }
  /** The merged mesh now (null while no member draws). */
  get mesh(): Mesh | null { return this.merged; }

  private queue(): void {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => { this.queued = false; this.rebuild(); });
  }

  /** Concatenate every member's triangles not in a hidden quadrant into one geometry, replacing the last one. */
  rebuild(): void {
    const old = this.merged;
    this.merged = null;
    if (old !== null) { old.removeFromParent(); old.geometry.dispose(); }
    const first = this.members.values().next().value; if (first === undefined) return;
    const names = Object.keys(first.mesh.geometry.attributes).filter(name => [...this.members.values()].every(member => member.mesh.geometry.hasAttribute(name))), parentInverse = new Matrix4(), toParent = new Matrix4();
    this.parent.updateWorldMatrix(true, false); parentInverse.copy(this.parent.matrixWorld).invert();
    // sized up front and filled in place (G639: growing number arrays for every tile's attributes held a 183 ms frame,
    // a quarter of it collection, each time a Nalati tile streamed in on the drive)
    const drawn = [...this.members.values()].filter(member => member.hidden.size < 4);
    let vertices = 0, indices = 0;
    for (const member of drawn) { const geometry = member.mesh.geometry, source = geometry.getIndex(); vertices += geometry.getAttribute('position').count; indices += source === null ? geometry.getAttribute('position').count : source.count; }
    const values = new Map(names.map(name => [name, new Float32Array(vertices * first.mesh.geometry.getAttribute(name).itemSize)])), index = new Uint32Array(indices);
    let base = 0, written = 0;
    for (const member of drawn) {
      const geometry = member.mesh.geometry, position = geometry.getAttribute('position'), source = geometry.getIndex();
      member.mesh.updateWorldMatrix(true, false); toParent.multiplyMatrices(parentInverse, member.mesh.matrixWorld);
      const e = toParent.elements;
      for (const name of names) {
        const attribute = geometry.getAttribute(name), out = values.get(name);
        if (out === undefined || attribute.count !== position.count) throw new Error(`Ground merge member lacks ${name}`);
        if (name === 'position') {
          // Vector3.applyMatrix4, inlined
          for (let i = 0; i < attribute.count; i++) {
            const x = position.getX(i), y = position.getY(i), z = position.getZ(i), w = 1 / ((e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 1)), at = (base + i) * 3;
            out[at] = ((e[0] ?? 1) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0)) * w;
            out[at + 1] = ((e[1] ?? 0) * x + (e[5] ?? 1) * y + (e[9] ?? 0) * z + (e[13] ?? 0)) * w;
            out[at + 2] = ((e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 1) * z + (e[14] ?? 0)) * w;
          }
        } else {
          const size = attribute.itemSize;
          for (let i = 0; i < attribute.count; i++) for (let c = 0; c < size; c++) out[(base + i) * size + c] = attribute.getComponent(i, c);
        }
      }
      const count = source === null ? position.count : source.count, at = (k: number): number => source === null ? k : source.getX(k);
      for (let t = 0; t + 2 < count; t += 3) {
        const a = at(t), b = at(t + 1), c = at(t + 2);
        if (member.corner !== null && member.hidden.size > 0) {
          const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3 - member.corner.x, cz = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3 - member.corner.z;
          if (member.hidden.has((cz >= COARSE / 2 ? 2 : 0) + (cx >= COARSE / 2 ? 1 : 0))) continue;
        }
        index[written++] = base + a; index[written++] = base + b; index[written++] = base + c;
      }
      base += position.count;
    }
    if (written === 0) return;
    const geometry = new BufferGeometry();
    for (const name of names) { const out = values.get(name); if (out !== undefined) geometry.setAttribute(name, new BufferAttribute(out, first.mesh.geometry.getAttribute(name).itemSize)); }
    geometry.setIndex(new BufferAttribute(base > 65535 ? index.slice(0, written) : Uint16Array.from(index.subarray(0, written)), 1));
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, this.material);
    mesh.name = this.name; mesh.castShadow = false; mesh.receiveShadow = true;
    this.onRebuild?.(mesh);
    this.parent.add(mesh); this.merged = mesh;
  }
}

const merges = new WeakMap<Object3D, Map<Material, GroundMerge>>();
/** The one merge of `material` under `parent` (made on first use; it empties itself as its last member leaves). */
export function groundMerge(parent: Object3D, material: Material, name: string): GroundMerge {
  let byMaterial = merges.get(parent);
  if (byMaterial === undefined) { byMaterial = new Map(); merges.set(parent, byMaterial); }
  let merge = byMaterial.get(material);
  if (merge === undefined) { merge = new GroundMerge(parent, material, name); byMaterial.set(material, merge); }
  return merge;
}
