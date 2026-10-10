/**
 * A shard's own post stack (SHARD-PLATFORM SF59 steps 3–4, G158, budget v1 C4-R1-A5 / C7): inside its cell a shard's
 * look owns the whole frame, its post passes included, as data. `look.post` is an ordered list of at most
 * {@link POST_STACK_BUDGET}`.passes` authored post graphs (`kind: "post"`), each inline (`{ graph }`) or a graph file of the
 * library closure (`{ file }`, validated with its bytes at product admission). Each pass is a full-screen program; its
 * instruction estimate is a per-pixel cost at the phone's 2× render scale, so the stack's cost is the sum of its passes'
 * estimates plus the normal pre-pass when any pass reads `sceneNormal` ({@link POST_NORMAL_PREPASS_COST}, paid once).
 * Admission refuses a stack past {@link POST_STACK_BUDGET}`.instructions` on its own; where two cells' frames blend at a
 * cell edge, the pair's sum is checked by {@link postPairRefusal} (the heaviest neighbour at the worst location). All of
 * it is static: no runtime sensing. Pure data and checks: no three.js.
 */
import * as v from 'valibot';
import { validateGraph, type GraphIr, type PostInputs } from '@wildshard/engine/core/materialGraph';
import { graphBindingSources, graphFileJson } from './materials';
import { isJsonData } from './json';
import type { Shardfile } from './schema';

/** budget v1: at most 4 authored post passes and 1,000 post instructions per pixel at 2× (a pair at a blend included) */
export const POST_STACK_BUDGET = Object.freeze({ passes: 4, instructions: 1000 });
/**
 * The normal pre-pass a stack pays once when any of its passes reads `sceneNormal`, as per-pixel instructions at 2×
 * (budget v1's estimate: a second opaque draw of the visible scene writing packed view normals; revised only from a
 * pinned 2× benchmark, like the ceilings).
 */
export const POST_NORMAL_PREPASS_COST = 160;

const postGraph = v.pipe(v.unknown(), v.rawTransform(({ dataset, addIssue, NEVER }): GraphIr => {
  if (!isJsonData(dataset.value)) { addIssue({ message: 'post graph is plain JSON data' }); return NEVER; }
  const checked = validateGraph(dataset.value);
  if (!checked.ok) { addIssue({ message: checked.errors.join('; ') }); return NEVER; }
  if (checked.graph.kind !== 'post') { addIssue({ message: 'a post pass is a post graph, not a material' }); return NEVER; }
  return checked.graph;
}));
/** one authored pass: inline post graph IR, or a graph file of the library closure */
const PostPassSchema = v.union([
  v.strictObject({ graph: postGraph }),
  v.strictObject({ file: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)) }),
]);
/** `look.post`: the shard's ordered post passes (empty: the platform's own post only) */
export const PostStackSchema = v.pipe(v.array(PostPassSchema), v.maxLength(POST_STACK_BUDGET.passes));
/** One admitted pass. */
export type PostPass = v.InferOutput<typeof PostPassSchema>;

/** What a stack costs: its passes' per-pixel instructions, the pre-pass when any reads the normal, and the inputs read. */
export interface PostStackCost { readonly passes: number; readonly instructions: number; readonly inputs: PostInputs }

/** The empty stack's cost. */
export const NO_POST: PostStackCost = Object.freeze({ passes: 0, instructions: 0, inputs: Object.freeze({ colour: false, depth: false, normal: false }) });

/**
 * Validate and cost a stack: each pass under the author caps against the shard's admitted bindings (a graph file read
 * through `bytes`; undefined bytes are refused), the sum against the stack budget. Returns the cost and every refusal.
 */
export function postStackCost(source: Pick<Shardfile, 'look' | 'state'> & { readonly look: { readonly post?: readonly PostPass[] } }, bytes: (hash: string) => Uint8Array | undefined): { cost: PostStackCost; errors: string[] } {
  const errors: string[] = [], passes = source.look.post ?? [];
  const { day, state } = graphBindingSources(source);
  let instructions = 0;
  const inputs = { colour: false, depth: false, normal: false };
  passes.forEach((pass, index) => {
    let ir: unknown;
    try { ir = 'graph' in pass ? pass.graph : graphFileJson(pass.file, bytes); } catch (error) { errors.push(`post[${index}]: ${error instanceof Error ? error.message : 'graph file'}`); return; }
    const checked = validateGraph(ir, { dayKeys: [...day.keys()], stateFields: state });
    if (!checked.ok) { errors.push(...checked.errors.map((error) => `post[${index}]: ${error}`)); return; }
    if (checked.graph.kind !== 'post') { errors.push(`post[${index}]: a post pass is a post graph, not a material`); return; }
    instructions += checked.cost.instructions;
    inputs.colour ||= checked.inputs.colour; inputs.depth ||= checked.inputs.depth; inputs.normal ||= checked.inputs.normal;
  });
  if (inputs.normal) instructions += POST_NORMAL_PREPASS_COST;
  if (passes.length > POST_STACK_BUDGET.passes) errors.push(`post: ${passes.length} passes (at most ${POST_STACK_BUDGET.passes})`);
  if (instructions > POST_STACK_BUDGET.instructions) errors.push(`post: ≈ ${instructions} instructions per pixel at 2× (at most ${POST_STACK_BUDGET.instructions})`);
  return { cost: { passes: passes.length, instructions, inputs }, errors };
}

/**
 * The schema's rules for a stack: inline passes validate against the shard's bindings and sum within the budget; a graph
 * file pass must be a JSON file of the library closure (`files` / `library` given; its bytes are costed by product
 * admission through `postStackCost`, so a stack holding files is summed there).
 */
export function postStackRules(source: Pick<Shardfile, 'look' | 'state'> & Partial<Pick<Shardfile, 'files' | 'library'>> & { readonly look: { readonly post?: readonly PostPass[] } }): string[] {
  const passes = source.look.post ?? [];
  if (passes.length === 0) return [];
  const errors: string[] = [];
  if (source.files !== undefined) {
    const files = new Map(source.files.map((row) => [row.hash, row])), closure = new Set<string>(), pending = [...source.library ?? []];
    while (pending.length > 0) { const hash = pending.pop(); if (hash === undefined || closure.has(hash)) continue; closure.add(hash); pending.push(...files.get(hash)?.dependencies ?? []); }
    passes.forEach((pass, index) => { if ('file' in pass && (files.get(pass.file)?.kind !== 'json' || !closure.has(pass.file))) errors.push(`post[${index}]: a graph file is a JSON file of the library closure`); });
  }
  if (passes.some((pass) => 'file' in pass)) return errors;
  return errors.concat(postStackCost(source, () => undefined).errors);
}

/**
 * Where two cells' frames blend (a crossing line at a cell edge), both stacks run: the pair's sum must fit the per-pixel
 * budget too. Null when it does, else the refusal (the grid checks each cell against its heaviest neighbour).
 */
export function postPairRefusal(a: PostStackCost, b: PostStackCost): string | null {
  // a shared normal pre-pass is drawn once for both
  const shared = a.inputs.normal && b.inputs.normal ? POST_NORMAL_PREPASS_COST : 0;
  const sum = a.instructions + b.instructions - shared;
  return sum > POST_STACK_BUDGET.instructions ? `post: ≈ ${sum} instructions per pixel at 2× where the two frames blend (at most ${POST_STACK_BUDGET.instructions})` : null;
}
