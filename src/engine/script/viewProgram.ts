/**
 * G600 L7: one view module and its rows (format/viewProgram) as a view-lane owner (SCRIPT-ABI v2, lane 3; WASM-HOST H9).
 * Each displayed frame it samples its binding's columns (the player, a registry piece's floor under the player,
 * constants, each pool's actor slots), runs the lane, re-adds the last landed bank's camera channels and, on landing,
 * writes its look, visibility, opacity, uniform and instanced-attribute channels and puts each validated matrix on its
 * target: a lent object, a named bone under it, one copy of a lent instanced draw, or the actor bound to a pool slot.
 * Every target is claimed once for its owner's life (a slot's actor for as long as it holds the slot) and restored when
 * it ends; a rendered pose is a visual only and never an authority position. Client-only.
 */
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, InterleavedBufferAttribute, Material, Matrix4, Quaternion, ShaderMaterial, Vector3,
  type Camera, type Object3D } from 'three';
import type { ViewProgramRows, ViewTargetRef } from '@wildshard/format/viewProgram';
import type { Scope } from '../app/scope';
import { ViewLane } from './viewLane';

/** The actor bound to one slot: its identity (a new one starts uninterpolated), pose, life, the ground under it, its
 *  named finite fields, the visual fields a program may set, and its drawn object. */
export interface ViewSlotActor {
  readonly identity: string; readonly object: Object3D;
  readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly alive: boolean; readonly ground: number;
  field: (name: string) => number;
  set: (name: string, value: number) => void;
}
/** A native group's ordered slots, as its owner binds them (null: the slot is free). */
export interface ViewSlots { actor: (slot: number) => ViewSlotActor | null }
/** What a program borrows from its owner. `floor` / `slots` are null for a piece / group the owner lacks. */
export interface ViewProgramPorts {
  readonly scope: Scope;
  readonly player: { readonly position: Vector3; readonly velocity: Vector3; readonly yaw: number };
  readonly camera: Camera;
  /** a lent numeric snapshot by id: each named field read once a frame; null for one the owner lacks */
  readonly values: (source: string) => ((field: string) => number) | null;
  readonly floor: (piece: string) => ((x: number, z: number) => number | undefined) | null;
  readonly slots: (group: string) => ViewSlots | null;
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
/** Claim `key` on `target` until `release` (returned) or the scope ends; `restore` runs on either. */
function claim(scope: Scope, target: object, key: string, restore: () => void): () => void {
  let held = claims.get(target); if (held === undefined) { held = new Set(); claims.set(target, held); }
  if (held.has(key)) throw new Error(`View target is already lent: ${key}`);
  held.add(key);
  let open = true;
  const release = (): void => { if (!open) return; open = false; held.delete(key); restore(); };
  scope.onDispose(release);
  return release;
}
const numberCell = (cell: unknown): cell is { value: number } => typeof cell === 'object' && cell !== null && 'value' in cell && typeof cell.value === 'number';
const materials = (object: Object3D): Material[] => {
  const value: unknown = Reflect.get(object, 'material'), list: readonly unknown[] = Array.isArray(value) ? value : [value];
  return list.filter((row): row is Material => row instanceof Material);
};
/** One write site over a lent object: claim it (saving what it restores) and set a value; re-made when a slot rebinds. */
type Site = (object: Object3D, release: (restore: () => void, key: string) => void) => (value: number | Matrix4) => void;

/** Install a program over its admitted module bytes, or null when a sampled piece or a pool's group is absent. */
export function viewProgram(bytes: Uint8Array, rows: ViewProgramRows, ports: ViewProgramPorts): ViewProgram | null {
  const floors = new Map<string, (x: number, z: number) => number | undefined>(), pools = new Map<string, { readonly slots: ViewSlots; readonly row: ViewProgramRows['pools'][number] }>();
  for (const row of rows.samples) if (row.kind === 'floor' && !floors.has(row.piece)) {
    const floor = ports.floor(row.piece); if (floor === null) return null; floors.set(row.piece, floor);
  }
  for (const row of rows.pools) { const slots = ports.slots(row.group); if (slots === null) return null; pools.set(row.id, { slots, row }); }
  const sources = new Map<string, (field: string) => number>();
  for (const row of rows.samples) if (row.kind === 'value' && !sources.has(row.source)) {
    const read = ports.values(row.source); if (read === null) return null; sources.set(row.source, read);
  }
  const scope = ports.scope, live = (): boolean => !scope.disposed && !scope.disposing;
  const position = new Vector3(), rotation = new Quaternion(), size = new Vector3();
  /** A target: a lent object is resolved and claimed once; a slot's actor on each write, re-claimed when its identity changes. */
  const target = (ref: ViewTargetRef, site: Site): ((value: number | Matrix4) => void) => {
    let identity: string | null = null, write: ((value: number | Matrix4) => void) | null = null, release: (() => void) | null = null;
    const bind = (object: Object3D, key: string): void => {
      release?.(); release = null;
      write = site(object, (restore, claimKey) => { release = claim(scope, object, `${key}:${claimKey}`, restore); });
    };
    if (typeof ref === 'string') { bind(ports.object(ref), 'lent'); return value => { write?.(value); }; }
    const pool = pools.get(ref.pool); if (pool === undefined) throw new Error(`Unknown view pool ${ref.pool}`);
    return value => {
      const actor = pool.slots.actor(ref.slot);
      if (actor === null) { release?.(); release = null; identity = null; write = null; return; }
      if (actor.identity !== identity) {
        identity = actor.identity;
        const object = ref.part === undefined ? actor.object : actor.object.getObjectByName(ref.part);
        if (object === undefined) { release?.(); release = null; write = null; return; }
        bind(object, `${ref.pool}#${String(ref.slot)}`);
      }
      write?.(value);
    };
  };
  const transformSite = (bone: string | null): Site => (owner, lend) => {
    const object = bone === null ? owner : owner.getObjectByName(bone);
    if (object === undefined) throw new Error(`View bone ${bone ?? ''} is missing`);
    const saved = { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), matrix: object.matrix.clone(), auto: object.matrixAutoUpdate };
    lend(() => { object.position.copy(saved.position); object.quaternion.copy(saved.quaternion); object.scale.copy(saved.scale); object.matrix.copy(saved.matrix);
      object.matrixAutoUpdate = saved.auto; object.matrixWorldNeedsUpdate = true; }, `transform:${bone ?? ''}`);
    return value => {
      if (typeof value === 'number') return;
      value.decompose(position, rotation, size);
      object.position.copy(position); object.quaternion.copy(rotation); object.scale.copy(size);
      object.matrix.copy(value); object.matrixAutoUpdate = false; object.matrixWorldNeedsUpdate = true;
    };
  };
  const setters = rows.transforms.map((row): ((value: number | Matrix4) => void) => {
    if (row.kind !== 'instance') return target(row.object, transformSite(row.kind === 'bone' ? row.bone : null));
    const owner = ports.object(row.object);
    if (!(owner instanceof InstancedMesh) || row.index >= owner.count) throw new Error(`View instance ${row.object}#${String(row.index)} is not a lent copy`);
    const saved = new Matrix4(), mesh = owner; mesh.getMatrixAt(row.index, saved);
    claim(scope, mesh, `instance:${String(row.index)}`, () => { mesh.setMatrixAt(row.index, saved); mesh.instanceMatrix.needsUpdate = true; });
    return value => { if (typeof value !== 'number') { mesh.setMatrixAt(row.index, value); mesh.instanceMatrix.needsUpdate = true; } };
  });
  // channels landed on landing; camera channels are re-added every displayed frame
  const writers = rows.channels.map((row): ((value: number) => void) | null => {
    if (row.kind === 'camera') return null;
    if (row.kind === 'look') return value => { ports.look(row.look, row.param, value); };
    if (row.kind === 'field') {
      const pool = pools.get(row.pool); if (pool === undefined) throw new Error(`Unknown view pool ${row.pool}`);
      const slots = pool.slots;
      return value => { slots.actor(row.slot)?.set(row.field, value); };
    }
    if (row.kind === 'color') return target(row.object, (object, lend) => {
      const list = materials(object).flatMap(material => { const color: unknown = Reflect.get(material, 'color'); return color instanceof Color ? [color] : []; });
      if (list.length === 0) throw new Error('View colour target has no coloured material');
      const saved = list.map(color => color.clone());
      lend(() => { for (const [i, color] of list.entries()) color.copy(saved[i] ?? color); }, 'color');
      const [r, g, b] = row.color;
      return value => { if (typeof value === 'number') for (const color of list) color.setRGB(r * value, g * value, b * value); };
    });
    if (row.kind === 'visible') return target(row.object, (object, lend) => {
      const saved = object.visible; lend(() => { object.visible = saved; }, 'visible');
      return value => { if (typeof value === 'number') object.visible = value > .5; };
    });
    if (row.kind === 'opacity') return target(row.object, (object, lend) => {
      const list = materials(object), saved = list.map(material => material.opacity);
      if (list.length === 0) throw new Error('View opacity target has no material');
      lend(() => { for (const [i, material] of list.entries()) material.opacity = saved[i] ?? material.opacity; }, 'opacity');
      return value => { if (typeof value === 'number') for (const material of list) material.opacity = value; };
    });
    if (row.kind === 'uniform') return target(row.object, (object, lend) => {
      const cells = materials(object).flatMap(material => { const cell: unknown = material instanceof ShaderMaterial ? material.uniforms[row.uniform] : undefined; return numberCell(cell) ? [cell] : []; });
      if (cells.length === 0) throw new Error(`View uniform ${row.uniform} is not a number`);
      const saved = cells.map(cell => cell.value);
      lend(() => { for (const [i, cell] of cells.entries()) cell.value = saved[i] ?? cell.value; }, `uniform:${row.uniform}`);
      return value => { if (typeof value === 'number') for (const cell of cells) cell.value = value; };
    });
    const object = ports.object(row.object), geometry: unknown = Reflect.get(object, 'geometry');
    const cell: unknown = geometry instanceof BufferGeometry && geometry.hasAttribute(row.attribute) ? geometry.getAttribute(row.attribute) : undefined;
    if (!(cell instanceof BufferAttribute || cell instanceof InterleavedBufferAttribute) || row.index >= cell.count) throw new Error(`View attribute ${row.object}.${row.attribute} is missing`);
    const saved = cell.getComponent(row.index, row.component);
    const touch = (): void => { if (cell instanceof InterleavedBufferAttribute) cell.data.needsUpdate = true; else cell.needsUpdate = true; };
    claim(scope, cell, `${String(row.index)}:${String(row.component)}`, () => { cell.setComponent(row.index, row.component, saved); touch(); });
    return value => { cell.setComponent(row.index, row.component, value); touch(); };
  });
  // the binding's columns: each scalar sample, or a pool's block of slots (present, x, y, z, yaw, alive, fields)
  const width = (row: ViewProgramRows['samples'][number]): number => {
    if (row.kind !== 'pool') return 1;
    const pool = pools.get(row.pool)?.row; return pool === undefined ? 0 : pool.count * (7 + pool.fields.length);
  };
  const n = rows.samples.reduce((sum, row) => sum + width(row), 0), columns = new Float64Array(2 * n);
  const seen = new Map<string, (string | null)[]>([...pools].map(([key, pool]) => [key, Array.from({ length: pool.row.count }, () => null)]));
  const staged = rows.transforms.map(() => new Matrix4()), dirty = new Set<number>(), landed = new Float64Array(rows.channels.length);
  const lane = new ViewLane(bytes, rows.budget.pages, { bindings: [{ handle: 1, columns: n }],
    transforms: rows.transforms.map((_, output) => ({ binding: 0, output, element: 0 })), channels: rows.channels.length,
    bounds: rows.bounds, targetMs: rows.budget.targetMs, fuel: rows.budget.fuel }, {
    write: (index, matrix) => { const staging = staged[index]; if (staging === undefined) throw new Error('Unknown view transform'); if (live()) { staging.fromArray(matrix); dirty.add(index); } },
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
    // previous columns are last frame's current ones; a fresh value (a scalar, a new identity in a slot) has no previous
    columns.copyWithin(0, n, 2 * n);
    let k = 0;
    const put = (value: number, fresh: boolean): void => { if (fresh) columns[k] = value; columns[n + k] = value; k++; };
    for (const row of rows.samples) {
      if (row.kind === 'pool') {
        const pool = pools.get(row.pool), last = seen.get(row.pool);
        if (pool === undefined || last === undefined) throw new Error(`Unknown view pool ${row.pool}`);
        for (let slot = 0; slot < pool.row.count; slot++) {
          // a new identity in a slot starts without interpolation: its previous columns are its current ones
          const actor = pool.slots.actor(slot), identity = actor?.identity ?? null, fresh = identity !== last[slot]; last[slot] = identity;
          put(Number(actor !== null), fresh);
          for (const value of [actor?.x ?? 0, actor?.y ?? 0, actor?.z ?? 0, actor?.yaw ?? 0, Number(actor?.alive === true), actor?.ground ?? 0]) put(value, fresh);
          for (const field of pool.row.fields) put(actor === null ? 0 : actor.field(field), fresh);
        }
        continue;
      }
      if (row.kind === 'value') {
        const value = sources.get(row.source)?.(row.field) ?? Number.NaN;
        if (!Number.isFinite(value)) throw new Error(`View value ${row.source}.${row.field} is not finite`);
        put(value, true); continue;
      }
      const floor = row.kind === 'floor' ? floors.get(row.piece)?.(p.x, p.z) : undefined;
      put(row.kind === 'constant' ? row.value : row.kind === 'floor' ? (row.field === 'present' ? Number(floor !== undefined) : floor ?? 0)
        : row.field === 'speed' ? Math.hypot(player.velocity.x, player.velocity.z) : row.field === 'yaw' ? player.yaw : p[row.field], true);
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
