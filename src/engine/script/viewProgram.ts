/**
 * G600 L7: one view module and its rows (format/viewProgram) as a view-lane owner (SCRIPT-ABI v2, lane 3; WASM-HOST H9).
 * Each displayed frame it samples its binding's columns (the player, a registry piece's floor under the player,
 * constants), runs the lane, re-adds the last landed bank's camera channels and, on landing, writes its look, visibility,
 * opacity, uniform and instanced-attribute channels and puts each validated matrix on its target: a lent object's local
 * matrix, a bone under it, or one copy of a lent instanced draw. Every target is claimed for the owner's life and
 * restored when it ends; a rendered pose is a visual only and never an authority position. Client-only.
 */
import { BufferAttribute, BufferGeometry, InstancedMesh, InterleavedBufferAttribute, Material, Matrix4, Quaternion, ShaderMaterial, Vector3, type Camera, type Object3D } from 'three';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import type { Scope } from '../app/scope';
import { ViewLane } from './viewLane';

/** What a program borrows from its owner. `floor` is null for a piece the registry lacks. */
export interface ViewProgramPorts {
  readonly scope: Scope;
  readonly player: { readonly position: Vector3; readonly velocity: Vector3 };
  readonly camera: Camera;
  readonly floor: (piece: string) => ((x: number, z: number) => number | undefined) | null;
  readonly object: (id: string) => Object3D;
  readonly look: (look: string, param: string, value: number) => void;
}
export interface ViewProgram {
  /** one displayed frame (the presentation delta) */
  frame: (dt: number) => void;
  readonly frozen: boolean;
}

/** Every claimed target of every live program: an object's transform or channel, or one instanced copy. */
const claims = new WeakMap<object, Set<string>>();
function claim(scope: Scope, target: object, key: string, restore: () => void): void {
  let held = claims.get(target); if (held === undefined) { held = new Set(); claims.set(target, held); }
  if (held.has(key)) throw new Error(`View target is already lent: ${key}`);
  held.add(key);
  scope.onDispose(() => { held.delete(key); restore(); });
}
const numberCell = (cell: unknown): cell is { value: number } => typeof cell === 'object' && cell !== null && 'value' in cell && typeof cell.value === 'number';
const materials = (object: Object3D): Material[] => {
  const value: unknown = Reflect.get(object, 'material'), list: readonly unknown[] = Array.isArray(value) ? value : [value];
  return list.filter((row): row is Material => row instanceof Material);
};

/** Install a program over its admitted module bytes, or null when a sampled piece is absent (nothing installs). */
export function viewProgram(bytes: Uint8Array, rows: ViewProgramRows, ports: ViewProgramPorts): ViewProgram | null {
  const floors = new Map<string, (x: number, z: number) => number | undefined>();
  for (const row of rows.samples) if (row.kind === 'floor' && !floors.has(row.piece)) {
    const floor = ports.floor(row.piece); if (floor === null) return null; floors.set(row.piece, floor);
  }
  const scope = ports.scope, live = (): boolean => !scope.disposed && !scope.disposing;
  // transforms: each position's setter over its claimed target
  const position = new Vector3(), rotation = new Quaternion(), size = new Vector3();
  const setters = rows.transforms.map((row): (matrix: Matrix4) => void => {
    const owner = ports.object(row.object);
    if (row.kind === 'instance') {
      if (!(owner instanceof InstancedMesh) || row.index >= owner.count) throw new Error(`View instance ${row.object}#${String(row.index)} is not a lent copy`);
      const saved = new Matrix4(), mesh = owner; mesh.getMatrixAt(row.index, saved);
      claim(scope, mesh, `instance:${String(row.index)}`, () => { mesh.setMatrixAt(row.index, saved); mesh.instanceMatrix.needsUpdate = true; });
      return matrix => { mesh.setMatrixAt(row.index, matrix); mesh.instanceMatrix.needsUpdate = true; };
    }
    const object = row.kind === 'bone' ? owner.getObjectByName(row.bone) : owner;
    if (object === undefined) throw new Error(`View bone ${row.object}/${row.kind === 'bone' ? row.bone : ''} is missing`);
    const saved = { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), matrix: object.matrix.clone(), auto: object.matrixAutoUpdate };
    claim(scope, object, 'transform', () => {
      object.position.copy(saved.position); object.quaternion.copy(saved.quaternion); object.scale.copy(saved.scale); object.matrix.copy(saved.matrix);
      object.matrixAutoUpdate = saved.auto; object.matrixWorldNeedsUpdate = true;
    });
    return matrix => {
      matrix.decompose(position, rotation, size);
      object.position.copy(position); object.quaternion.copy(rotation); object.scale.copy(size);
      object.matrix.copy(matrix); object.matrixAutoUpdate = false; object.matrixWorldNeedsUpdate = true;
    };
  });
  // channels landed on landing; camera channels are re-added every displayed frame
  const writers = rows.channels.map((row): ((value: number) => void) | null => {
    if (row.kind === 'camera') return null;
    if (row.kind === 'look') return value => { ports.look(row.look, row.param, value); };
    const object = ports.object(row.object);
    if (row.kind === 'visible') {
      const saved = object.visible; claim(scope, object, 'visible', () => { object.visible = saved; });
      return value => { object.visible = value > .5; };
    }
    if (row.kind === 'opacity') {
      const list = materials(object), saved = list.map(material => material.opacity);
      if (list.length === 0) throw new Error(`View opacity ${row.object} has no material`);
      claim(scope, object, 'opacity', () => { for (const [i, material] of list.entries()) material.opacity = saved[i] ?? material.opacity; });
      return value => { for (const material of list) material.opacity = value; };
    }
    if (row.kind === 'uniform') {
      const cells = materials(object).flatMap(material => { const cell: unknown = material instanceof ShaderMaterial ? material.uniforms[row.uniform] : undefined; return numberCell(cell) ? [cell] : []; });
      if (cells.length === 0) throw new Error(`View uniform ${row.object}.${row.uniform} is not a number`);
      const saved = cells.map(cell => cell.value);
      claim(scope, object, `uniform:${row.uniform}`, () => { for (const [i, cell] of cells.entries()) cell.value = saved[i] ?? cell.value; });
      return value => { for (const cell of cells) cell.value = value; };
    }
    const geometry: unknown = Reflect.get(object, 'geometry');
    const cell: unknown = geometry instanceof BufferGeometry && geometry.hasAttribute(row.attribute) ? geometry.getAttribute(row.attribute) : undefined;
    if (!(cell instanceof BufferAttribute || cell instanceof InterleavedBufferAttribute) || row.index >= cell.count) throw new Error(`View attribute ${row.object}.${row.attribute} is missing`);
    const saved = cell.getComponent(row.index, row.component);
    const touch = (): void => { if (cell instanceof InterleavedBufferAttribute) cell.data.needsUpdate = true; else cell.needsUpdate = true; };
    claim(scope, cell, `${String(row.index)}:${String(row.component)}`, () => { cell.setComponent(row.index, row.component, saved); touch(); });
    return value => { cell.setComponent(row.index, row.component, value); touch(); };
  });
  const staged = rows.transforms.map(() => new Matrix4()), dirty = new Set<number>();
  const landed = new Float64Array(rows.channels.length), n = rows.samples.length, columns = new Float64Array(2 * n);
  const lane = new ViewLane(bytes, rows.budget.pages, { bindings: [{ handle: 1, columns: n }],
    transforms: rows.transforms.map((_, output) => ({ binding: 0, output, element: 0 })), channels: rows.channels.length,
    bounds: rows.bounds, targetMs: rows.budget.targetMs, fuel: rows.budget.fuel }, {
    write: (index, matrix) => { const target = staged[index]; if (target === undefined) throw new Error('Unknown view transform'); if (live()) { target.fromArray(matrix); dirty.add(index); } },
    channels: values => {
      landed.set(values.subarray(0, landed.length));
      if (live()) for (const [i, write] of writers.entries()) write?.(landed[i] ?? 0);
    },
    upload: () => {
      if (live()) for (const index of dirty) { const matrix = staged[index]; if (matrix !== undefined) setters[index]?.(matrix); }
      dirty.clear();
    },
  });
  const camera = ports.camera, player = ports.player;
  let tick = 0;
  return { get frozen() { return lane.isFrozen; }, frame: dt => {
    const p = player.position;
    for (const [k, row] of rows.samples.entries()) {
      const floor = row.kind === 'floor' ? floors.get(row.piece)?.(p.x, p.z) : undefined;
      const value = row.kind === 'constant' ? row.value : row.kind === 'floor' ? (row.field === 'present' ? Number(floor !== undefined) : floor ?? 0)
        : row.field === 'speed' ? Math.hypot(player.velocity.x, player.velocity.z) : p[row.field];
      columns[k] = value; columns[n + k] = value;
    }
    tick++;
    lane.frame(dt, 0, tick, [{ previousTick: tick - 1, currentTick: tick, values: columns }], 60, () => performance.now());
    if (lane.isFrozen) return;
    for (const [i, row] of rows.channels.entries()) {
      if (row.kind !== 'camera') continue;
      const value = landed[i] ?? 0;
      if (row.field === 'roll') camera.rotation.z += value; else if (row.field === 'pitch') camera.rotation.x += value;
      else if (row.field === 'yaw') camera.rotation.y += value; else camera.position[row.field] += value;
    }
  } };
}
