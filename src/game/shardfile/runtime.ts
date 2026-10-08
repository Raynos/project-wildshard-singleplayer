import * as v from 'valibot';
import type { ShardPlugin } from '../shard/plugin';
import { RuntimeCostSchema, runtimeAccountedBytes } from '../grid/runtimeCost';
import { RuntimeBindsSchema } from './runtimeBinds';

const cost = v.pipe(RuntimeCostSchema, v.check((row) => {
  try { runtimeAccountedBytes(row); return true; } catch { return false; }
}, 'Runtime cost must contain a positive safe measured content bound'));

/** A first-party transition entry, relative to its own shard folder; never an asset URL or arbitrary import. */
export const RuntimeSchema = v.strictObject({
  entry: v.pipe(v.string(), v.maxLength(160), v.regex(/^runtime\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/u)),
  cost: v.optional(cost),
  /** Behaviour sections this runtime binds in its own play scope (./runtimeBinds.ts); absent = none. */
  binds: v.optional(RuntimeBindsSchema),
});
/** Serializable declaration of the trusted TypeScript that remains during an 80/20 conversion. */
export type RuntimeDeclaration = v.InferOutput<typeof RuntimeSchema>;
/** Trusted composition-root binding; the declaration can select only the entry belonging to the same shard. */
export interface TrustedRuntimeEntry {
  readonly slug: string;
  readonly entry: string;
  readonly load: () => Promise<{ default: new () => ShardPlugin }>;
}
/** Resolve only explicitly registered first-party code. Neighbour preparation may import it without running hooks. */
export async function prepareTrustedRuntime(declaration: RuntimeDeclaration, slug: string, firstParty: boolean,
  entries: readonly TrustedRuntimeEntry[]): Promise<new () => ShardPlugin> {
  const parsed = v.parse(RuntimeSchema, declaration);
  if (!firstParty) throw new Error('Custom runtime requires a trusted first-party shard');
  const registered = new Map<string, TrustedRuntimeEntry[]>();
  for (const entry of entries) { const group = registered.get(entry.slug) ?? []; group.push(entry); registered.set(entry.slug, group); }
  const matches = (registered.get(slug) ?? []).filter((entry) => entry.entry === parsed.entry);
  if (matches.length !== 1) throw new Error('Runtime entry must have exactly one matching trusted shard binding');
  const match = matches[0];
  if (match === undefined) throw new Error('Missing trusted runtime entry');
  return (await match.load()).default;
}
