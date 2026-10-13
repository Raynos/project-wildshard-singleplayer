import { type BufferGeometry, Matrix4 } from 'three';
import * as v from 'valibot';
import { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import source from '../shard.config';
import world from '../data/world.generated.json' with { type: 'json' };
import { LayoutBake, LayoutRowsSchema, layoutReviver } from '../world/layoutBake';
import { SpecimenBake, type SpecimenPart } from '../world/specimens';

type Owner = Parameters<typeof readWholeGeometry>[0];
const owners: Owner[] = [];

/** Explicit session installation; importing the adapter does not install a reader. */
export function installNineGeometry(owner: Owner): void {
  if (owner.disposed) throw new Error('Nine geometry needs a live session');
  if (owners.includes(owner)) return;
  owners.push(owner);
  owner.onDispose(() => { const index = owners.indexOf(owner); if (index !== -1) owners.splice(index, 1); });
}

async function geometries(refs: readonly string[]): Promise<Map<string, BufferGeometry>> {
  const owner = owners.at(-1);
  if (owner === undefined) throw new Error('Nine geometry reader was not installed');
  const views = await readWholeGeometry(owner, source, refs), result = new Map<string, BufferGeometry>(), identity = new Matrix4();
  const entries = [...views];
  if (entries.length > 122) throw new Error('Nine source draw bound exceeded');
  for (let index = 0; index < 122; index++) {
    const entry = entries[index]; if (entry === undefined) break;
    const [id, view] = entry;
    if (!view.matrix.equals(identity)) throw new Error(`Nine source draw ${id} changed its identity placement`);
    // Existing runtime kits/model contexts take ownership; drop the temporary assembler registration.
    view.release?.(); result.set(id, view.geometry);
  }
  return result;
}

/** Whole L0 fabric and the unchanged out-of-cube crown, rebuilt into the original source draws. */
export async function readNineLayout(pause: () => Promise<void> = () => Promise.resolve()): Promise<LayoutBake> {
  const refs = [...source.props?.tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? [])) ?? [], ...world.libraries.layout];
  const views = await geometries(refs), indexed = new Map<number, BufferGeometry>();
  // JSON intentionally revives the encoded -0 and infinite floor/box values: the rows through a copy, the 689k float64
  // records one by one into their array with `pause` between runs (the reviver over the whole layout was one ~0.3 s
  // desktop task in the world hook, sp-o101)
  const revived: unknown = JSON.parse(JSON.stringify(world.layout.rows), layoutReviver);
  await pause();
  const layout = { rows: v.parse(LayoutRowsSchema, revived), records: await reviveRecords(world.layout.records, pause) };
  if (layout.rows.geometries.length !== 36) throw new Error('Nine layout draw count differs');
  for (let index = 0; index < 36; index++) {
    const id = `layout_${index}`, geometry = views.get(id);
    if (geometry === undefined) throw new Error(`Missing Nine source draw ${id}`);
    indexed.set(index, geometry);
  }
  if (views.size !== indexed.size) throw new Error('Unexpected Nine layout source draw');
  return new LayoutBake(layout.rows, layout.records, indexed);
}

/** Records a layout may hold (689,416 today). */
const RECORD_BOUND = 4_000_000;

/** The layout's records as doubles, each revived as the JSON reviver would ('-0', 'Infinity', '-Infinity'), in runs. */
async function reviveRecords(rows: readonly (number | string)[], pause: () => Promise<void>): Promise<Float64Array> {
  if (rows.length > RECORD_BOUND) throw new Error('Nine layout record bound exceeded');
  const out = new Float64Array(rows.length);
  for (let i = 0; i < Math.min(rows.length, RECORD_BOUND); i++) {
    const value = layoutReviver('', rows[i]);
    if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`Nine layout record ${String(i)} is not a number`);
    out[i] = value;
    if ((i & 4095) === 4095) await pause();
  }
  return out;
}

/** Lazy Explorer library and mandatory boot specimens use the same bounded standard GLB reader. */
export async function readNineSpecimens(part: SpecimenPart): Promise<SpecimenBake> {
  const views = await geometries(world.libraries[part]);
  const entries = [...views];
  if (entries.length > 86) throw new Error('Nine specimen draw bound exceeded');
  for (let index = 0; index < 86; index++) {
    const entry = entries[index]; if (entry === undefined) break;
    const [key, geometry] = entry;
    if (world.specimenBoxes[key as keyof typeof world.specimenBoxes]) geometry.computeBoundingBox();
    else geometry.boundingBox = null;
  }
  return new SpecimenBake(views);
}
