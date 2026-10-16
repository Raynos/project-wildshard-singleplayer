import { parsePlatformDataSection } from '@wildshard/format/platformDataSections';

/** Explicit admitted decision/move context crossing the worker boundary; no ABI is inferred from bytes. */
export function headlessSections(input?: ReadonlyMap<string, unknown>): Map<string, unknown> {
  const sections = new Map<string, unknown>();
  for (const name of ['sim/scripts', 'actors/moves', 'world/targets'] as const) {
    if (input?.has(name) === true) sections.set(name, parsePlatformDataSection(name, input.get(name)));
  }
  return sections;
}
