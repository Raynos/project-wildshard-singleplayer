/** Original timber welds and depth-only band proxies, completed before publication. */
import { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TimberRow } from './timberRows';
import { TIMBER_DRAWS, TIMBER_GLASS } from './timberDraws';

/** The retained flags are author facts; material owners and tier bands remain named data ports. */
export interface TimberSceneCopy {
  readonly identity: string;
  readonly row: TimberRow;
  readonly pad: number;
  readonly draws: readonly {
    readonly geometry: string; readonly material: string;
    readonly castShadow: boolean; readonly receiveShadow: boolean;
    readonly renderOrder: number; readonly sphere: readonly [number, number, number, number]; readonly until?: number;
  }[];
  readonly proxies: readonly { readonly geometry: string; readonly sphere: readonly [number, number, number, number]; readonly until?: number }[];
}

// three's declaration omits its null refusal for incompatible channels.
function merge(list: BufferGeometry[]): BufferGeometry | null { return mergeGeometries(list); }

/** Equivalent to timberModel's libraryModel build; no merge remains for a page to perform. */
export function bakeTimberCopy(source: ReadonlyMap<string, BufferGeometry>, row: TimberRow, identity: string, pad: number): {
  readonly copy: TimberSceneCopy; readonly geometry: ReadonlyMap<string, BufferGeometry>;
} {
  const geometry = new Map<string, BufferGeometry>();
  const sphere = (shape: BufferGeometry): readonly [number, number, number, number] => {
    shape.computeBoundingSphere();
    const bound = shape.boundingSphere;
    if (bound === null) throw new Error('Missing timber sphere');
    return [bound.center.x, bound.center.y, bound.center.z, bound.radius];
  };
  const draws: TimberSceneCopy['draws'][number][] = [];
  const bands = new Map<number | undefined, BufferGeometry[]>();
  const add = (key: keyof typeof TIMBER_DRAWS | 'glass'): void => {
    const original = source.get(key);
    if (original === undefined) throw new Error('Missing original timber part');
    // Each material occurs once in this copy. This is UnitParts.draw's exact
    // one-slot merge, completed offline without importing a live engine owner.
    const shape = merge([original]);
    if (shape === null) throw new Error('Timber draw channels differ');
    const flags = key === 'glass' ? { ...TIMBER_GLASS, until: 1 } : TIMBER_DRAWS[key];
    const depth = 'depth' in flags ? flags.depth : undefined;
    const until = 'until' in flags ? flags.until : undefined;
    const renderOrder = 'renderOrder' in flags ? flags.renderOrder : 0;
    const castShadow = 'castShadow' in flags ? flags.castShadow : false;
    const id = `${identity}-draw-${String(draws.length)}`;
    geometry.set(id, shape);
    draws.push({ geometry: id, material: key, castShadow,
      receiveShadow: flags.receiveShadow, renderOrder, sphere: sphere(shape),
      ...(until === undefined ? {} : { until }) });
    if (depth === 'proxy') {
      const position = new BufferGeometry(); position.setAttribute('position', shape.getAttribute('position'));
      const previous = bands.get(until);
      if (previous === undefined) bands.set(until, [position]); else previous.push(position);
    }
  };
  try {
    for (const part of row.parts) if (part.counts.length > 0) add(part.key);
    if (row.glass.length > 0) add('glass');
    const order = [...(bands.has(undefined) ? [undefined] : []),
      ...[...bands.keys()].filter((band): band is number => band !== undefined).sort((a, b) => a - b)];
    const proxies: TimberSceneCopy['proxies'][number][] = [];
    for (const [index, until] of order.entries()) {
      const shape = merge(bands.get(until) ?? []);
      if (shape === null) throw new Error('Timber proxy channels differ');
      const id = `${identity}-proxy-${String(index)}`; geometry.set(id, shape);
      proxies.push({ geometry: id, sphere: sphere(shape), ...(until === undefined ? {} : { until }) });
    }
    return { copy: { identity, row, pad, draws, proxies }, geometry };
  } finally {
    for (const value of source.values()) value.dispose();
    for (const list of bands.values()) for (const value of list) value.dispose();
  }
}
