import * as v from 'valibot';
import { lightVolumeRows } from './lightVolumes';
import worldRows from '../data/worldRows.generated.json' with { type: 'json' };
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import wireSchema from './layoutSchema.generated.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };
import world from '../data/world.generated.json' with { type: 'json' };
import { LayoutRowsSchema, GeometryBootSchema } from './sections';
import { SET_TILES } from './worldScenes';

function revive(_key: string, value: unknown): unknown {
  return value === '-0' ? -0 : value === 'Infinity' ? Infinity : value === '-Infinity' ? -Infinity : value;
}
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

/** Separate small author rows from raw float64 records; no megabyte JSON parse runs at native boot. */
export function layoutBlobs(): NamedBlob[] {
  const rows = v.parse(LayoutRowsSchema, JSON.parse(JSON.stringify(layout.rows), revive));
  const records = layout.records.map(value => revive('', value));
  if (records.length !== layout.count || records.some(value => typeof value !== 'number' || Number.isNaN(value))) throw new Error('Nine layout record inventory differs');
  const numeric = v.parse(v.array(v.number()), records), floats = Float64Array.from(numeric);
  const tiles = v.parse(v.array(v.object({ file: v.string(), additionalFiles: v.exactOptional(v.array(v.string())) })), world.props.tiles);
  const library = { ...world.libraries, layout: [...tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? [])), ...world.libraries.layout.filter(hash => !SET_TILES.has(hash))],
    specimenBoxes: world.specimenBoxes, records: numeric.length, layoutDraws: rows.geometries.length };
  const negativeZeros: string[][] = [];
  const locate = (value: unknown, path: string[]): void => {
    if (Object.is(value, -0)) negativeZeros.push(path);
    else if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) locate(child, [...path, key]);
  };
  locate(rows, []);
  const boot = v.parse(GeometryBootSchema, { rows, library, negativeZeros, world: worldRows.rows, volumes: lightVolumeRows() });
  return [nameBlob('geometry/layout.json', 'json', json(boot), { jsonSchema: wireSchema }),
    nameBlob('geometry/layout-f64.bin', 'bin', new Uint8Array(floats.buffer)),
    nameBlob('geometry/world-f64.bin', 'bin', new Uint8Array(Float64Array.from(worldRows.records).buffer))];
}
