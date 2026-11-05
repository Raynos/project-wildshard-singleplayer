import * as v from 'valibot';
import { PostGraphLookSchema, type PostGraphLookRow } from './postGraphLook.ts';
import { GrassPresentationSchema, StaticCaptureSchema } from './fieldPresentation.ts';
import { SpecimenTextureSchema } from './specimenCatalogue.ts';
import { parsePaintedTerrain } from './materialFamilies.ts';
import { PaintedAirSchema, PaintedGroundSchema, PaintedPanoramaSchema, PainterKeyLightSchema, PainterlyWorldSchema } from './paintedResources.ts';
import { parseScaledPostRow } from './scaledPostContract.ts';

const tiles = v.record(v.string(), v.looseObject({ texture: v.optional(SpecimenTextureSchema) }));

/** Admit a complete post-graph document, including the original native
 * contracts of every optional painted resource, before creating its owners.
 * Nested rows are checked without replacing or normalizing the caller's data. */
export function parsePostGraphDocument(input: unknown): PostGraphLookRow {
  const row = v.parse(PostGraphLookSchema, input), painted = row.painted;
  for (const pass of Object.values(row.passes)) parseScaledPostRow(pass);
  const composite = row.passes[row.composite.pass];
  if (composite === undefined) throw new Error(`Post-graph look has no pass ${row.composite.pass}`);
  if (!Object.hasOwn(composite.outputs, row.composite.output)) throw new Error(`Post-graph look has no output ${row.composite.output}`);
  for (const side of row.sides) if ('pass' in side && !Object.hasOwn(row.passes, side.pass)) throw new Error(`Post-graph look has no pass ${side.pass}`);
  if (painted === undefined) return row;
  v.parse(PaintedAirSchema, painted.air);
  const ground = v.parse(PaintedGroundSchema, painted.ground);
  parsePaintedTerrain(ground.surface);
  v.parse(tiles, painted.tiles);
  v.parse(StaticCaptureSchema, painted.capture);
  v.parse(GrassPresentationSchema, painted.grass.rows);
  if (painted.world !== undefined) {
    const world = painted.world;
    v.parse(PainterlyWorldSchema, world.rows);
    v.parse(PaintedPanoramaSchema, world.panorama);
    if (world.key !== null) v.parse(PainterKeyLightSchema, world.key);
    if (!Object.hasOwn(world.grade.uniforms, world.grade.saturation)) throw new Error(`Painted world grade has no ${world.grade.saturation}`);
  }
  return row;
}
