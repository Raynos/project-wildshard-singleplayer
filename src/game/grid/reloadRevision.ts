import type { GridAssembly } from './assembly';
import { findShard } from '../shard/registry';
import { boundedResponse } from '../shardfile/product';
import { parseShardfile } from '../shardfile/schema';

/** Read bounded authored metadata only; the early residency owner still precedes all asset admission and allocation. */
export async function gridReloadRevision(assembly: GridAssembly, instance: string): Promise<number> {
  const cell = assembly.cell(instance);
  // A transitional home still boots its legacy world; its generated grid metadata is not a live descriptor switch.
  const descriptor = findShard(cell.slug)?.shardfile ?? `/shardfiles/${cell.slug}/shard.json`;
  const response = await fetch(new URL(descriptor, location.href));
  if (!response.ok) throw new Error(`Planned reload source unavailable: ${response.status}`);
  const bytes = await boundedResponse(response, 2_000_000);
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const source = parseShardfile(input);
  if (!new Set([cell.slug]).has(source.identity.slug)) throw new Error('Planned reload source identity changed');
  return source.identity.revision;
}
