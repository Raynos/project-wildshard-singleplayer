import { parsePlatformDataSection } from '@wildshard/format/platformDataSections';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

const NAMES = ['sim/scripts', 'actors/spawn-scripts', 'actors/return-scripts', 'actors/moves', 'world/targets', 'sim/runtime-plan'] as const;

/** Explicit admitted decision/move context crossing the worker boundary; no ABI is inferred from bytes. */
export function headlessSections(input?: ReadonlyMap<string, unknown>): Map<string, unknown> {
  const sections = new Map<string, unknown>();
  for (const name of NAMES) {
    if (input?.has(name) === true) sections.set(name, parsePlatformDataSection(name, input.get(name)));
  }
  return sections;
}
/** Forward the complete verified native context, including targets and plan selection. */
export function productHeadlessSections(product: ShardProduct): Map<string, unknown> {
  return headlessSections(new Map(NAMES.filter(name => product.has(name)).map(name => [name, product.section(name)])));
}
