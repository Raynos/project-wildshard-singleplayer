import { ResidencyAllocator } from '../grid/allocator';
import type { PageResidency, HomeResidencyClaim } from '../grid/pageResidency';
import type { Shardfile } from './schema';

/** Resolve the shared page budget before the ordinary level bootstrap; runtime homes must already be accounted. */
export function clientResidency(source: Pick<Shardfile, 'budgets' | 'runtime'>, bindings: {
  instance: string; allocator?: ResidencyAllocator; residency?: PageResidency;
}): { allocator: ResidencyAllocator; home?: HomeResidencyClaim } {
  const owner = bindings.residency;
  if (owner === undefined) return { allocator: bindings.allocator ?? new ResidencyAllocator() };
  if (bindings.allocator !== undefined && bindings.allocator !== owner.allocator) throw new Error('Shardfile page and client must share one residency allocator');
  // A hybrid world hook runs after the shell allocated. Preserve any root preclaim;
  // declared critical sim cost is a lower-bound check, never a replacement for a runtime's whole-home measurement.
  const preclaimed = source.runtime !== null || owner.allocator.has(`sim:${bindings.instance}`);
  const home = preclaimed ? owner.home() : owner.admitHome(bindings.instance, source.budgets.sim.resident);
  if (home.instance !== bindings.instance || home.allocator !== owner.allocator) throw new Error('Shardfile home residency identity mismatch');
  if (home.bytes < source.budgets.sim.resident) throw new Error('Home residency understates the declared simulation budget');
  return { allocator: owner.allocator, home };
}
