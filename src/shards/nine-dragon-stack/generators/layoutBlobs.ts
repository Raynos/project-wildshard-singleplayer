import * as v from 'valibot';
import worldRows from '../data/worldRows.generated.json' with { type: 'json' };
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { formatJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import type { NineSourceWorld } from './worldProgram';
import { GeometryBootSchema } from './sections';
import { bakedLayout } from './layoutProjection';
import type { NineWorldScenes } from './worldScenes';

const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

/** The defining schema is projected directly, without a generated schema file. */
export function layoutWireSchema(): ReturnType<typeof formatJsonSchema> { return formatJsonSchema(GeometryBootSchema, 'draft-07'); }

/** Separate small author rows from raw float64 records; no megabyte JSON parse runs at native boot. */
export function layoutBlobs(source: NineSourceWorld, { SET_TILES }: NineWorldScenes): NamedBlob[] {
  const world = source.metadata;
  const { rows, records: numeric } = bakedLayout(source.layout);
  const tiles = v.parse(v.array(v.object({ file: v.string(), additionalFiles: v.exactOptional(v.array(v.string())) })), world.props?.tiles);
  const library = { ...world.libraries, layout: [...tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? [])), ...world.libraries.layout.filter(hash => !SET_TILES.has(hash))],
    specimenBoxes: world.specimenBoxes, records: numeric.length, layoutDraws: rows.geometries.length };
  const negativeZeros: string[][] = [];
  const locate = (value: unknown, path: string[]): void => {
    if (Object.is(value, -0)) negativeZeros.push(path);
    else if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) locate(child, [...path, key]);
  };
  locate(rows, []);
  const boot = v.parse(GeometryBootSchema, { rows, library, negativeZeros, world: worldRows.rows });
  return [nameBlob('geometry/layout.json', 'json', json(boot), { jsonSchema: layoutWireSchema() })];
}
