import * as v from 'valibot';
import { CLIENT_SCRIPT_LIMITS } from './wireLimits';

const finite = v.pipe(v.number(), v.finite()), positive = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const targetId = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const ref = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
const coordinate = v.pipe(finite, v.minValue(-250), v.maxValue(250)), vec3 = v.tuple([coordinate, coordinate, coordinate]);
const channel = v.pipe(finite, v.minValue(0), v.maxValue(1)), velocity = v.pipe(finite, v.minValue(-15), v.maxValue(15));
const target = v.variant('kind', [v.strictObject({ kind: v.literal('creature'), id: targetId }), v.strictObject({ kind: v.literal('panel'), id: targetId }), v.strictObject({ kind: v.literal('prop'), id: targetId }),
  v.strictObject({ kind: v.literal('particles'), id: targetId, at: vec3 })]);
const emitter = v.strictObject({ id: positive, recipe: v.literal('platform.particles'), perTick: v.pipe(positive, v.maxValue(256)), live: v.pipe(positive, v.maxValue(4096)), lifetimeTicks: v.pipe(positive, v.maxValue(3600)),
  colour: v.tuple([channel, channel, channel]), size: v.pipe(finite, v.minValue(0.01), v.maxValue(4)), velocity: v.tuple([velocity, velocity, velocity]), gravity: v.pipe(finite, v.minValue(-30), v.maxValue(30)) });
/** Presentation bytecode binds visual targets and selected numeric state; it never joins the authoritative script lane. */
export const ClientScriptsSchema = v.strictObject({ divisor: v.pipe(positive, v.check((n) => 60 % n === 0, 'Client cadence divides 60')),
  bindings: v.pipe(v.array(v.strictObject({ module: ref, entity: positive, name, target,
    reads: v.pipe(v.array(v.strictObject({ scope: v.picklist(['shared', 'player']), id: positive })), v.maxLength(CLIENT_SCRIPT_LIMITS.fields)),
    parameters: v.pipe(v.array(finite), v.maxLength(CLIENT_SCRIPT_LIMITS.parameters)), pose: v.boolean(), maxOffset: v.pipe(finite, v.minValue(0), v.maxValue(50)),
    minScale: v.pipe(finite, v.minValue(0.01), v.maxValue(1)), maxScale: v.pipe(finite, v.minValue(1), v.maxValue(16)),
    emitters: v.pipe(v.array(emitter), v.maxLength(CLIENT_SCRIPT_LIMITS.emitters)) })), v.maxLength(CLIENT_SCRIPT_LIMITS.bindings)) });
/** Renderer-neutral declaration consumed by the client and the frozen-neighbour presentation adapter. */
export type ShardClientScripts = v.InferOutput<typeof ClientScriptsSchema>;
/** Charge the bounded particle pool: 56 CPU bytes and 32 GPU bytes per live slot. */
export function clientScriptViewCost(data: ShardClientScripts): { capacity: number; decoded: number; gpu: number; triangles: number; draws: number } {
  const capacity = Math.min(CLIENT_SCRIPT_LIMITS.particlesLive, data.bindings.reduce((sum, binding) => sum + binding.emitters.reduce((n, row) => n + row.live, 0), 0));
  return { capacity, decoded: capacity * 56, gpu: capacity * 32, triangles: 0, draws: capacity > 0 ? 1 : 0 };
}
/** A declared visual anchor resolved by trusted composition, never by a bytecode physics query. */
export type ClientScriptTarget = ShardClientScripts['bindings'][number]['target'];
/** Minimal format view for admission and projection, independent of rendering and author callbacks. */
export interface ClientScriptContent {
  identity: { seed: number }; clientScripts: ShardClientScripts;
  state: { shared: readonly { id: number; name: string; type: string; privacy: string }[]; player: readonly { id: number; name: string; type: string; privacy: string }[] };
  sim: { scripts: readonly string[] }; files: readonly { hash: string; kind: string; dependencies: readonly string[] }[]; library: readonly string[];
  creatures: { spawns: readonly { id: string }[] }; props: { panels: readonly { id: string }[]; models: readonly { id: string }[] } | null;
}
/** Refuse hidden fields, undeclared targets, competing writers and modules outside the admitted render library. */
export function clientScriptRules(source: ClientScriptContent): string[] {
  const bindings = source.clientScripts.bindings, errors: string[] = [], closure = new Set<string>(), files = new Map(source.files.map((file) => [file.hash, file]));
  const include = (id: string): void => { if (closure.has(id)) return; closure.add(id); for (const dependency of files.get(id)?.dependencies ?? []) include(dependency); };
  for (const root of source.library) include(root);
  if (new Set(bindings.map((b) => b.entity)).size !== bindings.length || new Set(bindings.map((b) => b.name)).size !== bindings.length || new Set(bindings.map((b) => `${b.target.kind}/${b.target.id}`)).size !== bindings.length) errors.push('unique client visual bindings');
  for (const binding of bindings) {
    if (!closure.has(binding.module) || source.sim.scripts.includes(binding.module) || (!binding.module.startsWith('commons:') && files.get(binding.module)?.kind !== 'wasm')) errors.push('client Wasm module belongs only to library');
    if (binding.target.kind === 'creature' && !source.creatures.spawns.some((spawn) => spawn.id === binding.target.id)) errors.push('declared client creature target');
    if (binding.target.kind === 'panel' && !source.props?.panels.some((panel) => panel.id === binding.target.id)) errors.push('declared client panel target');
    if (binding.target.kind === 'prop' && !source.props?.models.some((model) => model.id === binding.target.id)) errors.push('declared client prop target');
    if (binding.target.kind === 'particles' && binding.pose) errors.push('particle anchor has no pose writer');
    if (new Set(binding.emitters.map((row) => row.id)).size !== binding.emitters.length || new Set(binding.reads.map((row) => `${row.scope}/${row.id}`)).size !== binding.reads.length) errors.push('unique client emitters and reads');
    for (const read of binding.reads) {
      const field = source.state[read.scope].find((row) => row.id === read.id);
      if (field === undefined || field.type === 'string' || (read.scope === 'shared' ? field.privacy !== 'public' : field.privacy === 'host')) errors.push('client state read must be public or owned numeric');
    }
  }
  return [...new Set(errors)];
}
/** Parse detached strict data before host composition allocates any guest instance. */
export function parseClientScripts(input: unknown): ShardClientScripts { return v.parse(ClientScriptsSchema, input); }
