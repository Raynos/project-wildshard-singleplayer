import { SHARDFILE_ADMISSION_LIMITS as L } from '@wildshard/format/admissionLimits';
import { parseSketchSvg, sketchReference, type CompendiumSketch } from '@wildshard/format/sketch';
import type { ShardRows } from '@wildshard/format/rows';

const prefix = 'data:image/svg+xml,';

/** Resolve each distinct sketch once from already-admitted bytes and derive its extra raster cost. */
export function compendiumSketches(rows: Pick<ShardRows, 'compendiums'>, assets: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, CompendiumSketch> {
  const result = new Map<string, CompendiumSketch>();
  for (const row of rows.compendiums) for (const entry of row.entries) {
    const ref = entry.sketch; if (result.has(ref)) continue;
    if (!sketchReference(ref)) throw new Error('Compendium sketch must be bounded inert SVG data or an admitted hash');
    if (ref.startsWith(prefix)) result.set(ref, parseSketchSvg(decodeURIComponent(ref.slice(prefix.length))));
    else {
      const bytes = assets.get(ref); if (bytes === undefined || bytes.length > L.textCharacters) throw new Error('Missing or oversized admitted sketch SVG');
      result.set(ref, parseSketchSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    }
  }
  return result;
}
