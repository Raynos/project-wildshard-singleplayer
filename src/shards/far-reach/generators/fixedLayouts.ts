import * as layout from './layout';
import * as crown from './crownLayout';

/** Compile fixed coordinates once; page consumers perform no placement maths. */
export function fixedLayoutFiles(): ReadonlyMap<string, Uint8Array> {
  const bytes = (value: Readonly<Record<string, unknown>>): Uint8Array => new TextEncoder().encode(`${JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))}\n`);
  return new Map([
    ['data/layout.generated.json', bytes(layout)],
    ['data/crownLayout.generated.json', bytes(crown)],
    ['data/mapPalette.generated.json', bytes(layout.SKY_REACH_MAP)],
  ]);
}
