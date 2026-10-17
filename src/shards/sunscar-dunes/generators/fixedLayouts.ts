import * as layout from './layout';
import * as dunes from './duneRows';
import { SIGNAL_DUNES_MAP } from './minimap';

/** Compile fixed coordinates once; page consumers perform no placement maths. */
export function fixedLayoutFiles(): ReadonlyMap<string, Uint8Array> {
  const bytes = (value: Readonly<Record<string, unknown>>): Uint8Array => new TextEncoder().encode(`${JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))}\n`);
  return new Map([
    ['data/layout.generated.json', bytes(layout)],
    ['data/duneRows.generated.json', bytes(dunes)],
    ['data/mapPalette.generated.json', bytes({ ...SIGNAL_DUNES_MAP })],
  ]);
}
