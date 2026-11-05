import * as v from 'valibot';
import { isJsonData } from './json.ts';
import { WorldSceneWeldFieldsSchema, WorldSceneWeldNodeSchema, worldSceneWeldFieldsValid, parseWorldSceneWeld, type WorldSceneWeld, type SceneFileReference } from './worldSceneWeld.ts';
import { LivingPageFieldsSchema, LivingPageInputSchema, type LivingPageInputRows } from './forestPage.ts';

const index = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65535));
const packedGraph = v.strictObject({ ...WorldSceneWeldFieldsSchema.entries, nodes: v.pipe(v.array(index), v.maxLength(4096)) });
const living = v.strictObject({ ...LivingPageFieldsSchema.entries, graph: packedGraph });
const common = { version: v.literal(1), nodes: v.pipe(v.array(WorldSceneWeldNodeSchema), v.maxLength(65536)) };
const shape = v.variant('kind', [
  v.strictObject({ ...common, kind: v.literal('weld'), rows: v.pipe(v.array(packedGraph), v.minLength(1), v.maxLength(16)) }),
  v.strictObject({ ...common, kind: v.literal('living'), rows: v.pipe(v.array(living), v.minLength(1), v.maxLength(16)) }),
]);
type PackedGraph = Omit<WorldSceneWeld, 'nodes'> & { nodes: number[] };
/** Native variants share only immutable node data, never runtime resources. */
export type WorldScenePage = { version: 1; nodes: WorldSceneWeld['nodes'] } & (
  { kind: 'weld'; rows: PackedGraph[] } |
  { kind: 'living'; rows: (Omit<LivingPageInputRows, 'graph'> & { graph: PackedGraph })[] });
function expand(nodes: WorldScenePage['nodes'], row: PackedGraph): WorldSceneWeld {
  const graph = { ...row, nodes: row.nodes.map(at => {
    const node = nodes[at];
    if (node === undefined) throw new Error('Missing native scene page node');
    return node;
  }) };
  if (!worldSceneWeldFieldsValid(graph)) throw new Error('Unique bounded frozen scene nodes and cull lanes');
  return graph;
}
const admitted = new WeakMap<object, WorldSceneWeld[]>();
function freezePage(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freezePage(child);
  Object.freeze(value);
}
function complete(page: WorldScenePage): boolean {
  try {
    const graphs = page.rows.map(row => expand(page.nodes, 'graph' in row ? row.graph : row));
    for (const graph of graphs) freezePage(graph);
    admitted.set(page, graphs);
    freezePage(page);
    return true;
  } catch { return false; }
}
/** At most sixteen complete native variants share one node table. The ordinary
 * 100k aggregate JSON rule applies before decoding; every expanded native graph
 * still passes its defining bounds, identities, contacts and finite-bit checks. */
export const WorldScenePageSchema: v.GenericSchema<unknown, WorldScenePage> = v.pipe(
  v.unknown(), v.check(isJsonData, 'Scene pages require bounded plain JSON'), shape,
  v.check(complete, 'Scene page requires complete native graphs'));
export function parseWorldScenePage(input: unknown): WorldScenePage { return v.parse(WorldScenePageSchema, input); }

/** Reconstitute a native graph in authored order before its existing owner runs. */
export function worldScenePageWeld(page: WorldScenePage, member: number): WorldSceneWeld {
  if (page.kind !== 'weld') throw new Error('Expected a native weld page');
  const row = page.rows[member];
  if (row === undefined) throw new Error('Missing native weld page member');
  const graph = admitted.get(page)?.[member];
  if (graph === undefined) throw new Error('Unadmitted native scene page');
  return graph;
}
export function worldScenePageLiving(page: WorldScenePage, member: number): LivingPageInputRows {
  if (page.kind !== 'living') throw new Error('Expected a native living page');
  const row = page.rows[member];
  if (row === undefined) throw new Error('Missing native living page member');
  const graph = admitted.get(page)?.[member];
  if (graph === undefined) throw new Error('Unadmitted native scene page');
  return v.parse(LivingPageInputSchema, { ...row, graph });
}

const decoded = new WeakMap<Uint8Array, { page: WorldScenePage; text: string; length: number }>();
const decoder = new TextDecoder('utf-8', { fatal: true });
function checked(bytes: Uint8Array): WorldScenePage {
  const text = decoder.decode(bytes), known = decoded.get(bytes);
  if (known !== undefined) {
    if (bytes.length !== known.length || text !== known.text) throw new Error('Native scene page byte owner changed');
    return known.page;
  }
  const page = parseWorldScenePage(JSON.parse(text));
  decoded.set(bytes, { page, text, length: bytes.length });
  return page;
}
/** Verified byte owners may share decoding, never a material or scene service. */
export function sceneWeldBytes(bytes: Uint8Array, reference: SceneFileReference): WorldSceneWeld {
  return reference.member === undefined ? parseWorldSceneWeld(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
    : worldScenePageWeld(checked(bytes), reference.member);
}
export function sceneLivingBytes(bytes: Uint8Array, reference: SceneFileReference): LivingPageInputRows {
  return reference.member === undefined ? v.parse(LivingPageInputSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
    : worldScenePageLiving(checked(bytes), reference.member);
}
