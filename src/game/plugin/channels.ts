import { Object3D } from 'three';
import { parseClientChannelInputs, parseClientChannels, type ClientChannelProperty } from '@wildshard/format/clientChannels';
import { checkBorrowedOwnerPath, resolveBorrowedOwner } from './borrowed';

/** Detached coordinate outputs for a private geometry kernel. */
export interface ClientTubeFrame { readonly fromX: number; readonly fromY: number; readonly fromZ: number;
  readonly toX: number; readonly toY: number; readonly toZ: number; readonly extent: number; readonly wave: number }

/** Detached connector values; only scalar DAG outputs cross into private presentation. */
export interface ClientConnectorFrame {
  readonly fromX: number; readonly fromY: number; readonly fromZ: number;
  readonly toX: number; readonly toY: number; readonly toZ: number;
  readonly atX: number; readonly atY: number; readonly atZ: number;
  readonly scaleX: number; readonly scaleY: number; readonly scaleZ: number;
  readonly enabled: number; readonly cache?: number;
}


export interface ClientChannelObservation { readonly time: number; readonly delta: number; readonly values: readonly number[] }
/** Read-only visual output; property getters expose no writable storage or authoritative object. */
export type ClientChannelFrame = Readonly<Partial<Record<ClientChannelProperty, number>>>;
/** A capability-limited numeric lane; it has no state setter, physics port, event writer or player reference. */
export function createClientChannels(input: unknown): {
  readonly reads: readonly string[]; readonly frame: ClientChannelFrame; readonly geometry?: ClientTubeFrame; readonly connectors?: readonly ClientConnectorFrame[]; evaluate: (observation: ClientChannelObservation) => void;
  bindNumeric: (rows: readonly ClientNumericPortRow[], targets: ReadonlyMap<string, unknown>) => ClientNumericPorts;
} {
  const program = parseClientChannels([input])[0]; if (program === undefined) throw new Error('Missing client channel program');
  const nodes = structuredClone(program.nodes), scratch = new Float64Array(nodes.length), published = new Float64Array(nodes.length), reads = new Float64Array(program.reads.length);
  const slots = structuredClone(program.locals ?? []), locals = new Float64Array(slots.length), previous = new Float64Array(slots.length), next = new Float64Array(slots.length);
  let initialized = false;
  // each expression's operand slots, read once (-1: none), so the evaluator never asks a node which fields it has
  const operandA = Int32Array.from(nodes, node => 'a' in node ? node.a : -1), operandB = Int32Array.from(nodes, node => 'b' in node ? node.b : -1);
  const frame: Partial<Record<ClientChannelProperty, number>> = {};
  for (const channel of program.channels) Object.defineProperty(frame, channel.property, { enumerable: true, get: () => published[channel.value] });
  Object.freeze(frame);
  const tube = program.geometry;
  const geometry: ClientTubeFrame | undefined = tube === undefined ? undefined : Object.freeze({
    get fromX() { return published[tube.from[0]] ?? Number.NaN; }, get fromY() { return published[tube.from[1]] ?? Number.NaN; }, get fromZ() { return published[tube.from[2]] ?? Number.NaN; },
    get toX() { return published[tube.to[0]] ?? Number.NaN; }, get toY() { return published[tube.to[1]] ?? Number.NaN; }, get toZ() { return published[tube.to[2]] ?? Number.NaN; },
    get extent() { return published[tube.extent] ?? Number.NaN; }, get wave() { return published[tube.wave] ?? Number.NaN; },
  });
  const connectors = program.connectors?.map(row => {
    const connectorFrame: ClientConnectorFrame = {
    get fromX() { return published[row.from[0]] ?? Number.NaN; }, get fromY() { return published[row.from[1]] ?? Number.NaN; }, get fromZ() { return published[row.from[2]] ?? Number.NaN; },
    get toX() { return published[row.to[0]] ?? Number.NaN; }, get toY() { return published[row.to[1]] ?? Number.NaN; }, get toZ() { return published[row.to[2]] ?? Number.NaN; },
    get atX() { return published[(row.at ?? row.from)[0]] ?? Number.NaN; }, get atY() { return published[(row.at ?? row.from)[1]] ?? Number.NaN; }, get atZ() { return published[(row.at ?? row.from)[2]] ?? Number.NaN; },
    get scaleX() { return published[row.scale[0]] ?? Number.NaN; }, get scaleY() { return published[row.scale[1]] ?? Number.NaN; }, get scaleZ() { return published[row.scale[2]] ?? Number.NaN; },
    get enabled() { return published[row.enabled] ?? Number.NaN; },
    };
    const cache = row.cache;
    if (cache !== undefined) Object.defineProperty(connectorFrame, 'cache', { enumerable: true, get: () => published[cache] ?? Number.NaN });
    return Object.freeze(connectorFrame);
  });
  if (connectors !== undefined) Object.freeze(connectors);
  const evaluate = (observation: ClientChannelObservation): void => {
    const { time, delta, values } = observation;
    if (!Number.isFinite(time) || !Number.isFinite(delta) || delta < 0 || Math.abs(time) > 1e12 || delta > 1e12 || values.length !== reads.length) throw new Error('Invalid copied client observation');
    for (let i = 0; i < reads.length; i++) { const value = values[i]; if (value === undefined || !Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Invalid copied client state'); reads[i] = value; }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]; if (slot === undefined) throw new Error('Missing private client slot');
      previous[i] = initialized ? locals[i] ?? Number.NaN : slot.initial.op === 'constant' ? slot.initial.value : reads[slot.initial.index] ?? Number.NaN;
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]; if (node === undefined) throw new Error('Missing client expression');
      const ai = operandA[i] ?? -1, bi = operandB[i] ?? -1;
      const a = ai >= 0 ? scratch[ai] ?? Number.NaN : 0, b = bi >= 0 ? scratch[bi] ?? Number.NaN : 0;
      let value: number;
      switch (node.op) {
        case 'constant': value = node.value; break;
        case 'clock': value = node.value === 'time' ? time : delta; break;
        case 'read': value = reads[node.index] ?? Number.NaN; break;
        case 'local': value = previous[node.index] ?? Number.NaN; break;
        case 'neg': value = -a; break;
        case 'sin': value = Math.sin(a); break;
        case 'cos': value = Math.cos(a); break;
        case 'sqrt': value = Math.sqrt(a); break;
        case 'abs': value = Math.abs(a); break;
        case 'add': value = a + b; break;
        case 'sub': value = a - b; break;
        case 'mul': value = a * b; break;
        case 'pow': value = a ** b; break;
        case 'div': value = a / b; break;
        case 'mod': value = a % b; break;
        case 'min': value = Math.min(a, b); break;
        case 'max': value = Math.max(a, b); break;
        case 'atan2': value = Math.atan2(a, b); break;
        case 'hypot': value = Math.hypot(a, b); break;
        case 'hypot3': value = Math.hypot(a, b, scratch[node.c] ?? Number.NaN); break;
        case 'sample': {
          const last = node.keys.at(-1); if (last === undefined) throw new Error('Missing keyframe endpoint');
          value = last[1];
          for (let segment = 1; segment < node.keys.length; segment++) {
            const start = node.keys[segment - 1], end = node.keys[segment];
            if (start === undefined || end === undefined) throw new Error('Missing keyframe segment');
            if (a > end[0]) continue;
            const u = Math.max(0, Math.min(1, (a - start[0]) / Math.max(1e-6, end[0] - start[0])));
            const eased = node.interpolation === 'smoothstep' ? u * u * (3 - 2 * u) : u;
            value = start[1] + (end[1] - start[1]) * eased; break;
          }
          break;
        }
        case 'gt': value = Number(a > b); break;
        case 'select': value = (scratch[node.test] ?? Number.NaN) !== 0 ? scratch[node.yes] ?? Number.NaN : scratch[node.no] ?? Number.NaN; break;
        default: throw new Error('Unknown client operation');
      }
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Non-finite or excessive client expression');
      scratch[i] = value;
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]; if (slot === undefined) throw new Error('Missing private client slot');
      next[i] = scratch[slot.next] ?? Number.NaN;
    }
    published.set(scratch); locals.set(next); initialized = true;
  };
  return Object.freeze({ bindNumeric: createClientNumericPorts, reads: Object.freeze([...program.reads]), frame, evaluate, ...(geometry === undefined ? {} : { geometry }), ...(connectors === undefined ? {} : { connectors }) });
}


/** A numeric visual loan: a copied channel writes one named field, never a script-state grant. */
export interface ClientNumericPortRow {
  readonly property: ClientChannelProperty; readonly target: string; readonly path: readonly string[];
  readonly restore?: boolean; readonly nullable?: boolean;
}
/** Bind a bounded list of explicitly loaned visual fields. Unknown roots, prototypes, non-numeric fields,
 * authoritative actor classes and readonly fields refuse. Capture restores only declared borrowed values;
 * this binder owns no clock, scene object, listener or simulation state. */
export interface ClientNumericPorts { apply: (frame: ClientChannelFrame) => void; capture: () => () => void }
function createClientNumericPorts(rows: readonly ClientNumericPortRow[], targets: ReadonlyMap<string, unknown>): ClientNumericPorts {
  if (rows.length > 32) throw new Error('Numeric visual port roster exceeds its bound');
  const ports = rows.flatMap(row => {
    const root = targets.get(row.target); if (root === null) return [];
    if (/^(?:player|shared|state)(?:[.:]|$)/u.test(row.target) || row.path.length === 0 || row.path.length > 2
      || row.path.some(key => key.length === 0 || key.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Invalid numeric visual loan');
    if (typeof root !== 'object') throw new Error('Missing numeric visual target');
    const scene = root instanceof Object3D;
    const prototype: unknown = Object.getPrototypeOf(root);
    if (!scene && prototype !== Object.prototype && prototype !== null) throw new Error('Numeric ports require plain visual fields');
    if (scene && (row.path.length !== 2 || !['position', 'rotation', 'scale'].includes(row.path[0] ?? '') || !['x', 'y', 'z'].includes(row.path[1] ?? ''))) throw new Error('Numeric scene port must be a transform');
    let parent: unknown = root;
    for (const key of row.path.slice(0, -1)) {
      if (typeof parent !== 'object' || parent === null || !Object.hasOwn(parent, key)) throw new Error('Missing numeric visual owner');
      parent = Reflect.get(parent, key);
    }
    const key = row.path.at(-1);
    if (typeof parent !== 'object' || parent === null || key === undefined || (!scene && !Object.hasOwn(parent, key))) throw new Error('Missing numeric visual field');
    const value: unknown = Reflect.get(parent, key);
    if (typeof value !== 'number' && !(row.nullable === true && value === null)) throw new Error('Visual field is not numeric');
    return [{ row, target: parent, key }];
  });
  return {
    apply: frame => { for (const { row, target, key } of ports) {
      const value = frame[row.property];
      if (value === undefined || !Number.isFinite(value) || Math.abs(value) > 1e12 || !Reflect.set(target, key, value)) throw new Error('Numeric visual write refused');
    } },
    capture: () => { const saved = ports.filter(port => port.row.restore === true).map(port => {
      const value: unknown = Reflect.get(port.target, port.key); return { target: port.target, key: port.key, value };
    }); return () => { for (const row of saved) if (!Reflect.set(row.target, row.key, row.value)) throw new Error('Numeric visual restore refused'); }; },
  };
}

/** Borrow admitted scalar fields from supplied owners, never publishing their objects to the channel evaluator. */
export function bindClientChannelInputs(input: unknown, owners: ReadonlyMap<string, unknown>, reads: ReadonlySet<string>): ReadonlyMap<string, () => number> {
  const rows = parseClientChannelInputs(input), bound = new Map<string, () => number>();
  for (const row of rows) {
    if (!reads.has(row.input)) throw new Error(`Unused numeric input ${row.input}`);
    // the row's path is checked once here; every later read resolves it
    checkBorrowedOwnerPath(row);
    const read = (): number => {
      const field = resolveBorrowedOwner(owners, row), value = field?.value;
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error(`Invalid numeric input ${row.input}`);
      return value;
    };
    read(); bound.set(row.input, read);
  }
  return bound;
}
