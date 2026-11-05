import * as v from 'valibot';
import { validateGraph, type GraphIr } from './materialGraph.ts';
import type { ScaledPostRow } from './scaledPost.ts';

const number = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const storageSchema = v.picklist(['float16', 'unorm8']);
const graph = v.custom<GraphIr>(input => {
  const checked = validateGraph(input, { trustedBudget: true });
  return checked.ok && checked.graph.kind === 'post';
}, 'Invalid scaled post graph');
const term = v.union([number, name, v.null(), v.strictObject({ param: name }),
  v.strictObject({ setting: name, div: v.exactOptional(number), per: v.exactOptional(v.strictObject({ target: name, axis: v.picklist(['width', 'height']) })) })]);
const schema: v.GenericSchema<unknown, ScaledPostRow> = v.strictObject({
  name,
  programs: v.record(name, v.strictObject({ graph, links: v.exactOptional(v.array(name)), depth: v.exactOptional(name),
    camera: v.exactOptional(v.record(name, v.picklist(['projection', 'projectionInverse', 'view', 'world', 'nearFar', 'near', 'far']))),
    pack: v.exactOptional(v.record(name, v.array(term))), blend: v.exactOptional(v.literal('addKeepAlpha')) })),
  targets: v.record(name, v.strictObject({ name, of: name, scale: number, filter: v.picklist(['linear', 'nearest']), storage: v.exactOptional(storageSchema) })),
  draws: v.array(v.strictObject({ program: name, to: name, storage: v.exactOptional(storageSchema), textures: v.exactOptional(v.record(name, name)),
    texel: v.exactOptional(v.strictObject({ uniform: name, of: name })) })),
  settings: v.record(name, number), when: v.exactOptional(name), outputs: v.record(name, name), drawnOnly: v.exactOptional(v.boolean()),
});

/** Complete native post preflight. Graphs keep the executor's trusted budget;
 * target order, storage variants and draw/output references retain its rules.
 * The executor still checks these contracts before allocating and compiling. */
export function parseScaledPostRow(input: unknown): ScaledPostRow {
  const row = v.parse(schema, input), known = new Set(['input']);
  for (const [key, target] of Object.entries(row.targets)) {
    if (key === 'input' || !known.has(target.of) || target.scale <= 0 || target.scale > 1) throw new Error(`Invalid scaled post target ${key}`);
    known.add(key);
  }
  for (const draw of row.draws) {
    if (!Object.hasOwn(row.programs, draw.program) || !known.has(draw.to)
      || Object.values(draw.textures ?? {}).some(source => !known.has(source) || source === draw.to)
      || draw.texel !== undefined && !known.has(draw.texel.of)) throw new Error('Invalid scaled post draw');
  }
  for (const target of Object.values(row.outputs)) if (!known.has(target) || target === 'input') throw new Error('Invalid scaled post output');
  for (const storage of ['float16', 'unorm8']) {
    const active = new Set(['input']);
    for (const [key, target] of Object.entries(row.targets)) if (target.storage === undefined || target.storage === storage) {
      if (!active.has(target.of)) throw new Error('Post storage target needs an active size source');
      active.add(key);
    }
    for (const draw of row.draws) if ((draw.storage === undefined || draw.storage === storage)
      && (!active.has(draw.to) || Object.values(draw.textures ?? {}).some(source => !active.has(source))
        || draw.texel !== undefined && !active.has(draw.texel.of))) throw new Error('Post storage draw needs active targets');
  }
  return row;
}
