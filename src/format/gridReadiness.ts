import * as v from 'valibot';
import { ENTRY_ASPHALT, ENTRY_WIDTH } from './contentBounds';
import type { Shardfile } from './shardSchema';

const criterion = v.strictObject({ verdict: v.picklist(['pass', 'fail']), evidence: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)) });
/** Build evidence is meaningful only inside its exact index/source/validator-bound validation receipt. */
export const GridStructuralEvidenceSchema = v.strictObject({ version: v.literal(1), criteria: v.strictObject({
  bakedTiles: criterion, edgeProfile: criterion, fourEntryways: criterion, hudAccent: criterion,
}) });
export type GridStructuralEvidence = v.InferOutput<typeof GridStructuralEvidenceSchema>;
export function parseGridStructuralEvidence(input: unknown): GridStructuralEvidence { return v.parse(GridStructuralEvidenceSchema, input); }

/** Call only after full byte admission: terrain, mesh/socket landings, prop collision,
 * water and each complete approach footprint must have passed their defining validators.
 * This records those checks; it never turns declared memory or a shader row into a runtime witness. */
export function structuralGridEvidence(source: Shardfile): GridStructuralEvidence {
  const l0 = source.tiles.filter(row => row.lod === 0).length;
  return { version: 1, criteria: {
    bakedTiles: { verdict: l0 > 0 ? 'pass' : 'fail', evidence: `${l0} L0 / ${source.tiles.length} baked render tiles; referenced immutable bytes admitted` },
    edgeProfile: { verdict: 'pass', evidence: `Four admitted edge profiles; samples N/E/S/W ${[source.edge.north, source.edge.east, source.edge.south, source.edge.west].map(row => row.heights.length).join('/')}` },
    fourEntryways: { verdict: 'pass', evidence: `${source.entryways.length} unique midpoint entries at y=0; ${ENTRY_WIDTH}m width, ${ENTRY_ASPHALT}m asphalt depth; full terrain/mesh/socket landings, prop/collider and water clearance admitted` },
    hudAccent: { verdict: 'pass', evidence: `Declared palette accent: ${source.accent}` },
  } };
}
