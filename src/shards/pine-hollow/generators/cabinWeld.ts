/** Author-only completion of the native copy/whole weld and its depth proxies. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Original material identity, grouping key and distance band of one building part. */
export interface CabinWeldPart {
  readonly material: THREE.Material;
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly until?: number;
  readonly key?: string;
  readonly depth?: 'proxy' | 'near';
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly renderOrder?: number;
}
/** A native building already fitted to its site; casters are in its own frame. */
export interface CabinWeldCopy {
  readonly root: THREE.Object3D;
  readonly parts: readonly CabinWeldPart[];
  readonly casters?: readonly THREE.BufferGeometry[];
}
interface Drawn {
  readonly meshes: readonly { readonly mesh: THREE.Mesh; readonly part: CabinWeldPart }[];
  readonly proxies: readonly { readonly mesh: THREE.Mesh; readonly until: number | undefined }[];
  readonly front: readonly THREE.BufferGeometry[];
}

// Preserve three's runtime null refusal, omitted by its declaration.
function merge(shapes: THREE.BufferGeometry[]): THREE.BufferGeometry | null { return mergeGeometries(shapes); }
function bound(shape: THREE.BufferGeometry, box = false): void {
  shape.computeBoundingSphere();
  if (box) shape.computeBoundingBox();
}

/** Position-only merged caster, with the native shared depth material and layer. */
export function cabinShadowProxy(shapes: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh | null {
  const shape = shapes.length === 0 ? null : merge(shapes);
  if (shape === null) return null;
  bound(shape);
  const mesh = new THREE.Mesh(shape, material);
  mesh.castShadow = true; mesh.layers.set(9);
  return mesh;
}

/** Same doubled winding and Uint32 index as the native scan near caster. */
export function cabinTwoSidedPositions(shape: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry(), position = shape.getAttribute('position');
  result.setAttribute('position', position.clone());
  const source = shape.index, count = source === null ? position.count : source.count;
  const index = new Uint32Array(count * 2);
  for (let i = 0; i + 2 < count; i += 3) {
    const a = source === null ? i : source.getX(i), b = source === null ? i + 1 : source.getX(i + 1), c = source === null ? i + 2 : source.getX(i + 2);
    index[i] = a; index[i + 1] = b; index[i + 2] = c;
    index[count + i] = a; index[count + i + 1] = c; index[count + i + 2] = b;
  }
  result.setIndex(new THREE.BufferAttribute(index, 1));
  return result.applyMatrix4(matrix);
}

/** Native non-indexed positions, sharing the position channel when possible. */
export function cabinFlatPositions(shape: THREE.BufferGeometry): THREE.BufferGeometry {
  const source = shape.index === null ? shape : shape.toNonIndexed();
  return new THREE.BufferGeometry().setAttribute('position', source.getAttribute('position'));
}
function sequential(shape: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = shape.getAttribute('position'), index = new Uint32Array(position.count);
  for (let i = 0; i < index.length; i++) index[i] = i;
  return new THREE.BufferGeometry().setAttribute('position', position).setIndex(new THREE.BufferAttribute(index, 1));
}
/** Complete near depth exactly in native front-then-double-sided-caster order. */
export function cabinNearProxy(front: readonly THREE.BufferGeometry[], casters: readonly THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh | null {
  return cabinShadowProxy(casters.length === 0 ? [...front] : [...front.map(sequential), ...casters], material);
}

/** Native UnitParts slots: first material/band/key occurrence fixes draw order. */
export class CabinUnitParts {
  private readonly slots: { part: CabinWeldPart; shapes: THREE.BufferGeometry[] }[] = [];
  private readonly materials = new Map<THREE.Material, Map<string, { part: CabinWeldPart; shapes: THREE.BufferGeometry[] }>>();
  add(parts: readonly CabinWeldPart[], frame?: THREE.Matrix4): void {
    for (const part of parts) {
      if (part.geometries.length === 0) continue;
      let bands = this.materials.get(part.material);
      if (bands === undefined) { bands = new Map(); this.materials.set(part.material, bands); }
      const key = `${part.until ?? ''}|${part.key ?? ''}`;
      let slot = bands.get(key);
      if (slot === undefined) { slot = { part, shapes: [] }; bands.set(key, slot); this.slots.push(slot); }
      for (const shape of part.geometries) slot.shapes.push(frame === undefined ? shape : shape.applyMatrix4(frame));
    }
  }
  draw(root: THREE.Object3D, near: boolean, material: THREE.Material): Drawn {
    const meshes: { mesh: THREE.Mesh; part: CabinWeldPart }[] = [], front: THREE.BufferGeometry[] = [];
    const bands = new Map<number | undefined, THREE.BufferGeometry[]>();
    for (const { part, shapes } of this.slots) {
      const shape = merge(shapes);
      if (shape === null) throw new Error('Cabin weld material channels differ');
      bound(shape);
      const mesh = new THREE.Mesh(shape, part.material);
      mesh.receiveShadow = part.receiveShadow ?? false; mesh.castShadow = part.castShadow ?? false;
      if (part.renderOrder !== undefined) mesh.renderOrder = part.renderOrder;
      root.add(mesh); meshes.push({ mesh, part });
      if (part.depth === undefined) continue;
      const position = new THREE.BufferGeometry().setAttribute('position', shape.getAttribute('position'));
      front.push(position);
      if (part.depth !== 'proxy') continue;
      const previous = bands.get(part.until);
      if (previous === undefined) bands.set(part.until, [position]); else previous.push(position);
    }
    this.slots.length = 0; this.materials.clear();
    const order = [...(bands.has(undefined) ? [undefined] : []), ...[...bands.keys()].filter((value): value is number => value !== undefined).sort((a, b) => a - b)];
    const proxies: { mesh: THREE.Mesh; until: number | undefined }[] = [];
    for (const until of order) {
      const mesh = cabinShadowProxy(bands.get(until) ?? [], material);
      if (mesh === null) continue;
      root.add(mesh);
      if (near) mesh.castShadow = false;
      proxies.push({ mesh, until });
    }
    return { meshes, proxies, front };
  }
}

/** Author identity only: the hydration host restores the native WeldBatch class. */
export class CabinWeldBatch extends THREE.Mesh { readonly views: CabinWeldView[] = []; }
/** A selection share owns bounds and a matrix but borrows every batch attribute buffer. */
export class CabinWeldView extends THREE.Mesh {
  constructor(shape: THREE.BufferGeometry, material: THREE.Material, readonly batch: CabinWeldBatch, readonly start: number, readonly vertexCount: number) {
    super(shape, material);
  }
}
function slice(shape: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(shape.attributes)) {
    if (!(attr instanceof THREE.BufferAttribute)) throw new Error('Cabin weld view requires plain buffer attributes');
    result.setAttribute(name, new THREE.BufferAttribute(attr.array.subarray(start * attr.itemSize, (start + count) * attr.itemSize), attr.itemSize, attr.normalized));
  }
  bound(result, true);
  return result;
}
function across(copies: readonly { readonly root: THREE.Object3D; readonly meshes: readonly THREE.Mesh[] }[], parent: THREE.Object3D): void {
  const materials = new Map<THREE.Material, { root: THREE.Object3D; mesh: THREE.Mesh }[]>();
  for (const { root, meshes } of copies) for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) throw new Error('Cabin weld batch has multiple materials');
    const previous = materials.get(mesh.material);
    if (previous === undefined) materials.set(mesh.material, [{ root, mesh }]); else previous.push({ root, mesh });
  }
  for (const list of materials.values()) {
    const first = list[0];
    if (list.length < 2 || first === undefined || Array.isArray(first.mesh.material)) continue;
    const shape = merge(list.map(({ root, mesh }) => mesh.geometry.clone().applyMatrix4(root.matrix)));
    if (shape === null) throw new Error('Cabin cross-copy channels differ');
    bound(shape);
    const batch = new CabinWeldBatch(shape, first.mesh.material);
    batch.castShadow = first.mesh.castShadow; batch.receiveShadow = first.mesh.receiveShadow; batch.renderOrder = first.mesh.renderOrder;
    const pending: { root: THREE.Object3D; mesh: THREE.Mesh; view: CabinWeldView }[] = [];
    let start = 0;
    for (const { root, mesh } of list) {
      if (Array.isArray(mesh.material)) throw new Error('Cabin weld view has multiple materials');
      const count = mesh.geometry.getAttribute('position').count;
      const view = new CabinWeldView(slice(shape, start, count), mesh.material, batch, start, count);
      start += count;
      view.castShadow = mesh.castShadow; view.receiveShadow = mesh.receiveShadow; view.renderOrder = mesh.renderOrder;
      view.matrixAutoUpdate = false; view.matrix.copy(root.matrix).invert(); view.matrixWorldNeedsUpdate = true;
      pending.push({ root, mesh, view });
    }
    for (const { root, mesh, view } of pending) { root.remove(mesh); root.add(view); batch.views.push(view); }
    parent.add(batch);
  }
}

/** Complete the same frozen draws as Weld.join/finish, leaving culler setup as rows. */
export class CabinAuthorWeld {
  readonly copies: { readonly build: CabinWeldCopy; readonly always: THREE.Mesh[] }[] = [];
  private readonly whole: CabinUnitParts | null;
  constructor(readonly options: { readonly unit: 'copy' | 'whole'; readonly parent: THREE.Object3D; readonly root?: THREE.Object3D; readonly pad?: number; readonly detail: number; readonly near?: boolean }, private readonly shadow: THREE.Material) {
    this.whole = options.unit === 'whole' ? new CabinUnitParts() : null;
    if (options.unit === 'whole' && options.root === undefined) throw new Error('Whole cabin weld requires its root');
  }
  join(build: CabinWeldCopy): void {
    const options = this.options, casters = build.casters ?? [], always: THREE.Mesh[] = [];
    const root = options.unit === 'whole' ? options.root : undefined;
    let proxy: THREE.Mesh | null;
    if (this.whole !== null && root !== undefined) {
      this.whole.add(build.parts, new THREE.Matrix4().copy(root.matrix).invert().multiply(build.root.matrix));
      proxy = casters.length === 0 ? null : cabinNearProxy([], casters, this.shadow);
    } else {
      const near = options.near === true, unit = new CabinUnitParts(); unit.add(build.parts);
      const drawn = unit.draw(build.root, near, this.shadow);
      for (const { mesh, part } of drawn.meshes) {
        if (part.until === undefined) always.push(mesh); else mesh.userData['until'] = part.until;
      }
      for (const { mesh, until } of drawn.proxies) {
        if (until !== undefined) mesh.userData['until'] = until;
        if (near) mesh.userData['castFrom'] = options.detail;
      }
      proxy = near || casters.length > 0 ? cabinNearProxy(near ? drawn.front : [], casters, this.shadow) : null;
    }
    if (proxy !== null) { build.root.add(proxy); proxy.userData['until'] = options.detail; }
    this.copies.push({ build, always });
  }
  finish(): void {
    const options = this.options, root = options.root;
    if (this.whole !== null && root !== undefined) {
      const drawn = this.whole.draw(root, false, this.shadow), pad = options.pad ?? 0;
      for (const { mesh, part } of drawn.meshes) if (part.until !== undefined) mesh.userData['until'] = part.until + pad;
      for (const { mesh, until } of drawn.proxies) if (until !== undefined) mesh.userData['until'] = until + pad;
    } else across(this.copies.map(copy => ({ root: copy.build.root, meshes: copy.always })), options.parent);
  }
}
