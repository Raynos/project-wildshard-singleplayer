/**
 * Tile streaming P1 (draws): a splat ground's resident tiles drawn as one merged mesh per material, so a tiled ground takes
 * no more draws than the whole one. Each tile's ground mesh joins its merge hidden; the merge rebuilds (once per task, on a
 * microtask) whenever a tile arrives, leaves or (a coarse tile) changes which of its quadrants fine tiles cover: those
 * quadrants' triangles (by centroid) are left out, as the coarse tile mask's fragment test would hide them.
 *
 *   const merge = groundMerge(parent, material);
 *   const hide = merge.add(mesh, tileScope, { x: 1, z: 2 });   // a coarse tile; the fine tiles over it: hide(new Set([0, 3]))
 *
 * Positions go into the parent's space; every member must carry the same attributes (the first member's set is taken, and
 * a member without one is refused). The merged mesh receives shadow and never casts (as the tiles), and leaves with the
 * last member.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Vector3, type Material, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';

const HALF = 250, COARSE = 125;
interface Member { readonly mesh: Mesh; readonly corner: { readonly x: number; readonly z: number } | null; hidden: ReadonlySet<number> }

export class GroundMerge {
  private readonly members = new Map<Mesh, Member>();
  private merged: Mesh | null = null;
  private queued = false;
  constructor(private readonly parent: Object3D, private readonly material: Material, private readonly name: string) {}

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
    const names = Object.keys(first.mesh.geometry.attributes), parentInverse = new Matrix4(), toParent = new Matrix4(), point = new Vector3();
    this.parent.updateWorldMatrix(true, false); parentInverse.copy(this.parent.matrixWorld).invert();
    const values = new Map<string, number[]>(names.map(name => [name, []])), index: number[] = [];
    for (const member of this.members.values()) {
      if (member.hidden.size >= 4) continue;
      const geometry = member.mesh.geometry, position = geometry.getAttribute('position'), source = geometry.getIndex();
      member.mesh.updateWorldMatrix(true, false); toParent.multiplyMatrices(parentInverse, member.mesh.matrixWorld);
      const base = (values.get('position')?.length ?? 0) / 3;
      for (const name of names) {
        const attribute = geometry.getAttribute(name), out = values.get(name);
        if (out === undefined || attribute.count !== position.count) throw new Error(`Ground merge member lacks ${name}`);
        for (let i = 0; i < attribute.count; i++) {
          if (name === 'position') { point.fromBufferAttribute(position, i).applyMatrix4(toParent); out.push(point.x, point.y, point.z); }
          else for (let c = 0; c < attribute.itemSize; c++) out.push(attribute.getComponent(i, c));
        }
      }
      const count = source === null ? position.count : source.count, at = (k: number): number => source === null ? k : source.getX(k);
      for (let t = 0; t + 2 < count; t += 3) {
        const a = at(t), b = at(t + 1), c = at(t + 2);
        if (member.corner !== null && member.hidden.size > 0) {
          const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3 - member.corner.x, cz = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3 - member.corner.z;
          if (member.hidden.has((cz >= COARSE / 2 ? 2 : 0) + (cx >= COARSE / 2 ? 1 : 0))) continue;
        }
        index.push(base + a, base + b, base + c);
      }
    }
    if (index.length === 0) return;
    const geometry = new BufferGeometry();
    for (const name of names) geometry.setAttribute(name, new BufferAttribute(Float32Array.from(values.get(name) ?? []), first.mesh.geometry.getAttribute(name).itemSize));
    geometry.setIndex(new BufferAttribute((values.get('position')?.length ?? 0) / 3 > 65535 ? Uint32Array.from(index) : Uint16Array.from(index), 1));
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, this.material);
    mesh.name = this.name; mesh.castShadow = false; mesh.receiveShadow = true;
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
