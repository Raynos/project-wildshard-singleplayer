/**
 * G600 L7: one view module and its rows (format/viewProgram) as a view-lane owner (SCRIPT-ABI v2, lane 3; WASM-HOST H9).
 * Each displayed frame it samples its binding's columns (the player, a registry piece's floor under the player,
 * constants), runs the lane, adds the last landed channel bank to the camera and writes the look channels, and puts each
 * validated matrix on the object its owner lent for that position. Lent objects are claimed for the owner's life and
 * their local transform restored when it ends; a rendered pose is a visual only and never an authority position.
 * Client-only; nothing reaches the sim or a save.
 */
import { Matrix4, Quaternion, Vector3, type Camera, type Object3D } from 'three';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import type { Scope } from '../app/scope';
import { ViewLane, type ViewTargets } from './viewLane';

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

const claims = new WeakMap<Object3D, symbol>();
/** Matrix targets over lent objects: local matrices, restored with their transform flags when the owner ends. */
function objectTargets(scope: Scope, objects: readonly Object3D[]): Pick<ViewTargets, 'write' | 'upload'> {
  const token = Symbol('view transforms');
  if (new Set(objects).size !== objects.length || objects.some(object => claims.has(object))) throw new Error('View transform object is already lent');
  const saved = objects.map(object => ({ matrix: object.matrix.clone(), position: object.position.clone(), quaternion: object.quaternion.clone(),
    scale: object.scale.clone(), auto: object.matrixAutoUpdate }));
  const staged = objects.map(() => new Matrix4()), dirty = new Set<number>();
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  for (const object of objects) claims.set(object, token);
  scope.onDispose(() => {
    dirty.clear();
    for (const [i, object] of objects.entries()) {
      const row = saved[i];
      if (row === undefined || claims.get(object) !== token) continue;
      object.matrix.copy(row.matrix); object.position.copy(row.position); object.quaternion.copy(row.quaternion); object.scale.copy(row.scale);
      object.matrixAutoUpdate = row.auto; object.matrixWorldNeedsUpdate = true; claims.delete(object);
    }
  });
  const live = (): boolean => !scope.disposed && !scope.disposing;
  return {
    write: (index, matrix) => { const target = staged[index]; if (target === undefined) throw new Error('Unknown view transform'); if (live()) { target.fromArray(matrix); dirty.add(index); } },
    upload: () => {
      if (live()) for (const index of dirty) {
        const object = objects[index], matrix = staged[index];
        if (object === undefined || matrix === undefined) throw new Error('Unknown view transform');
        matrix.decompose(position, rotation, scale);
        object.position.copy(position); object.quaternion.copy(rotation); object.scale.copy(scale);
        object.matrix.copy(matrix); object.matrixAutoUpdate = false; object.matrixWorldNeedsUpdate = true;
      }
      dirty.clear();
    },
  };
}

/** Install a program over its admitted module bytes, or null when a sampled piece is absent (nothing installs). */
export function viewProgram(bytes: Uint8Array, rows: ViewProgramRows, ports: ViewProgramPorts): ViewProgram | null {
  const floors = new Map<string, (x: number, z: number) => number | undefined>();
  for (const row of rows.samples) if (row.kind === 'floor' && !floors.has(row.piece)) {
    const floor = ports.floor(row.piece); if (floor === null) return null; floors.set(row.piece, floor);
  }
  const transforms = objectTargets(ports.scope, rows.transforms.map(row => ports.object(row.object)));
  const landed = new Float64Array(rows.channels.length), n = rows.samples.length, columns = new Float64Array(2 * n);
  const lane = new ViewLane(bytes, rows.budget.pages, { bindings: [{ handle: 1, columns: n }],
    transforms: rows.transforms.map((_, output) => ({ binding: 0, output, element: 0 })), channels: rows.channels.length,
    bounds: rows.bounds, targetMs: rows.budget.targetMs, fuel: rows.budget.fuel }, { ...transforms, channels: values => {
    landed.set(values.subarray(0, landed.length));
    for (const [i, row] of rows.channels.entries()) if (row.kind === 'look') ports.look(row.look, row.param, landed[i] ?? 0);
  } });
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
