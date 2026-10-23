/**
 * Tile streaming P1 (draws): a splat ground's resident tiles drawn as merged meshes per material, one per 250 m block (a
 * 2 x 2 of coarse tiles: at most four draws over a cell), so a tiled ground takes about as few draws as the whole one.
 * Each tile's ground mesh joins its block's merge hidden; the block rebuilds (once per task, on a microtask) whenever one of
 * its tiles arrives, leaves or (a coarse tile) changes which of its quadrants fine tiles cover: those quadrants' triangles
 * (by centroid) are left out, as the coarse tile mask's fragment test would hide them.
 *
 *   const merge = groundMerge(parent, material);
 *   const hide = merge.add(mesh, tileScope, { x: 1, z: 2 });   // a coarse tile; the fine tiles over it: hide(new Set([0, 3]))
 *
 * Positions go into the parent's space; a block's merged mesh carries the attributes every member of it has (a coarse
 * tile's vertex colours, say, are left out when a fine tile has none). A merged mesh receives shadow and never casts (as
 * the tiles), and leaves with its block's last member. Each tile keeps its transformed attributes and its kept triangles
 * (refreshed when its transform, an attribute's version or its hidden quadrants change), so a rebuild is copies.
 */
import { BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Matrix4, Mesh, Vector3, type Material, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';

const HALF = 250, COARSE = 125, BLOCK = 250;
/** an attribute's change count (an interleaved one counts on its buffer) */
const versionOf = (attribute: BufferAttribute | InterleavedBufferAttribute): number => attribute instanceof InterleavedBufferAttribute ? attribute.data.version : attribute.version;
interface Cached<T> { readonly key: string; readonly version: number; readonly values: T }
interface Member {
  readonly mesh: Mesh; readonly corner: { readonly x: number; readonly z: number } | null; hidden: ReadonlySet<number>;
  /** this tile's attributes in the parent's space (position under its transform `key`), and its kept triangles */
  readonly attributes: Map<string, Cached<Float32Array>>; triangles: Cached<Uint32Array> | null;
}
interface Block { readonly members: Map<Mesh, Member>; merged: Mesh | null; queued: boolean }

export class GroundMerge {
  private readonly blocks = new Map<string, Block>();
  /** `onRebuild`: each new merged mesh, before it draws (its shadow flags, render order or a terrain's mesh slot) */
  constructor(private readonly parent: Object3D, private readonly material: Material, private readonly name: string, private readonly onRebuild?: (mesh: Mesh) => void) {}

  /** The tile's ground `mesh` joins (hidden itself) until `scope` ends; `coarse` (its coarse tile) returns the quadrant setter. */
  add(mesh: Mesh, scope: Scope, coarse?: { readonly x: number; readonly z: number }): (hidden: ReadonlySet<number>) => void {
    const corner = coarse === undefined ? null : { x: -HALF + coarse.x * COARSE, z: -HALF + coarse.z * COARSE };
    const member: Member = { mesh, corner, hidden: new Set(), attributes: new Map(), triangles: null };
    const key = this.blockOf(member);
    let block = this.blocks.get(key);
    if (block === undefined) { block = { members: new Map(), merged: null, queued: false }; this.blocks.set(key, block); }
    const owner = block;
    mesh.visible = false; owner.members.set(mesh, member); this.queue(owner);
    scope.onDispose(() => { if (owner.members.delete(mesh)) this.queue(owner); });
    return (hidden) => { member.hidden = new Set(hidden); this.queue(owner); };
  }

  /** How many members the merge draws (tests and the overlay read it). */
  get size(): number { let count = 0; for (const block of this.blocks.values()) count += block.members.size; return count; }
  /** Every block's merged mesh now. */
  get meshes(): readonly Mesh[] { return [...this.blocks.values()].flatMap(block => block.merged === null ? [] : [block.merged]); }
  /** The first block's merged mesh now (null while no member draws): a ground within one block draws as this one mesh. */
  get mesh(): Mesh | null { return this.meshes[0] ?? null; }

  /** the 250 m block a tile draws in: its coarse corner's, else its bounds centre's in the parent's space */
  private blockOf(member: Member): string {
    let x: number, z: number;
    if (member.corner !== null) { x = member.corner.x; z = member.corner.z; }
    else {
      const geometry = member.mesh.geometry; if (geometry.boundingBox === null) geometry.computeBoundingBox();
      const centre = geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
      this.parent.updateWorldMatrix(true, false); member.mesh.updateWorldMatrix(true, false);
      centre.applyMatrix4(new Matrix4().copy(this.parent.matrixWorld).invert().multiply(member.mesh.matrixWorld));
      x = centre.x; z = centre.z;
    }
    return `${String(Math.floor((x + HALF) / BLOCK))},${String(Math.floor((z + HALF) / BLOCK))}`;
  }

  private queue(block: Block): void {
    if (block.queued) return;
    block.queued = true;
    queueMicrotask(() => { block.queued = false; this.rebuildBlock(block); });
  }

  /** Rebuild every block now. */
  rebuild(): void { for (const block of this.blocks.values()) this.rebuildBlock(block); }

  /** Concatenate the block's members' triangles not in a hidden quadrant into one geometry, replacing its last one. */
  private rebuildBlock(block: Block): void {
    const old = block.merged;
    block.merged = null;
    if (old !== null) { old.removeFromParent(); old.geometry.dispose(); }
    const first = block.members.values().next().value; if (first === undefined) return;
    const names = Object.keys(first.mesh.geometry.attributes).filter(name => [...block.members.values()].every(member => member.mesh.geometry.hasAttribute(name))), parentInverse = new Matrix4(), toParent = new Matrix4();
    this.parent.updateWorldMatrix(true, false); parentInverse.copy(this.parent.matrixWorld).invert();
    // sized up front and filled from each member's kept arrays (G639: growing number arrays for the whole ground held a
    // 183 ms frame, and rebuilding all of it on every tile arrival still 78 ms, on a Nalati drive at phone 4x)
    const drawn = [...block.members.values()].filter(member => member.hidden.size < 4);
    const parts = drawn.map(member => {
      const geometry = member.mesh.geometry, position = geometry.getAttribute('position');
      member.mesh.updateWorldMatrix(true, false); toParent.multiplyMatrices(parentInverse, member.mesh.matrixWorld);
      const transform = toParent.elements.join(',');
      const attributes = names.map(name => {
        const attribute = geometry.getAttribute(name);
        if (attribute.count !== position.count) throw new Error(`Ground merge member lacks ${name}`);
        const key = name === 'position' ? transform : '', known = member.attributes.get(name);
        if (known !== undefined && known.key === key && known.version === versionOf(attribute)) return known.values;
        const size = attribute.itemSize, out = new Float32Array(attribute.count * size);
        if (name === 'position') {
          // Vector3.applyMatrix4, inlined
          const e = toParent.elements;
          for (let i = 0; i < attribute.count; i++) {
            const x = position.getX(i), y = position.getY(i), z = position.getZ(i), w = 1 / ((e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 1));
            out[i * 3] = ((e[0] ?? 1) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0)) * w;
            out[i * 3 + 1] = ((e[1] ?? 0) * x + (e[5] ?? 1) * y + (e[9] ?? 0) * z + (e[13] ?? 0)) * w;
            out[i * 3 + 2] = ((e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 1) * z + (e[14] ?? 0)) * w;
          }
        } else for (let i = 0; i < attribute.count; i++) for (let c = 0; c < size; c++) out[i * size + c] = attribute.getComponent(i, c);
        member.attributes.set(name, { key, version: versionOf(attribute), values: out });
        return out;
      });
      return { member, count: position.count, attributes, triangles: this.triangles(member) };
    });
    let vertices = 0, indices = 0;
    for (const part of parts) { vertices += part.count; indices += part.triangles.length; }
    if (indices === 0) return;
    const values = names.map(name => new Float32Array(vertices * first.mesh.geometry.getAttribute(name).itemSize)), index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    let base = 0, written = 0;
    for (const part of parts) {
      part.attributes.forEach((source, n) => { values[n]?.set(source, base * (source.length / Math.max(1, part.count))); });
      const triangles = part.triangles;
      for (let k = 0; k < triangles.length; k++) index[written++] = base + (triangles[k] ?? 0);
      base += part.count;
    }
    const geometry = new BufferGeometry();
    names.forEach((name, n) => { const out = values[n]; if (out !== undefined) geometry.setAttribute(name, new BufferAttribute(out, first.mesh.geometry.getAttribute(name).itemSize)); });
    geometry.setIndex(new BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, this.material);
    mesh.name = this.name; mesh.castShadow = false; mesh.receiveShadow = true;
    this.onRebuild?.(mesh);
    this.parent.add(mesh); block.merged = mesh;
  }

  /** The member's kept triangles (its own vertex numbers), kept until its index or hidden quadrants change. */
  private triangles(member: Member): Uint32Array {
    const geometry = member.mesh.geometry, position = geometry.getAttribute('position'), source = geometry.getIndex();
    const key = [...member.hidden].sort((x, y) => x - y).join(','), version = (source?.version ?? 0) * 65536 + versionOf(position);
    if (member.triangles !== null && member.triangles.key === key && member.triangles.version === version) return member.triangles.values;
    const count = source === null ? position.count : source.count, at = (k: number): number => source === null ? k : source.getX(k);
    const kept = new Uint32Array(count - count % 3);
    let written = 0;
    for (let t = 0; t + 2 < count; t += 3) {
      const a = at(t), b = at(t + 1), c = at(t + 2);
      if (member.corner !== null && member.hidden.size > 0) {
        const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3 - member.corner.x, cz = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3 - member.corner.z;
        if (member.hidden.has((cz >= COARSE / 2 ? 2 : 0) + (cx >= COARSE / 2 ? 1 : 0))) continue;
      }
      kept[written++] = a; kept[written++] = b; kept[written++] = c;
    }
    const values = kept.slice(0, written);
    member.triangles = { key, version, values };
    return values;
  }
}

const merges = new WeakMap<Object3D, Map<Material, GroundMerge>>();
/** The one merge of `material` under `parent` (made on first use; each block empties itself as its last member leaves). */
export function groundMerge(parent: Object3D, material: Material, name: string): GroundMerge {
  let byMaterial = merges.get(parent);
  if (byMaterial === undefined) { byMaterial = new Map(); merges.set(parent, byMaterial); }
  let merge = byMaterial.get(material);
  if (merge === undefined) { merge = new GroundMerge(parent, material, name); byMaterial.set(material, merge); }
  return merge;
}
