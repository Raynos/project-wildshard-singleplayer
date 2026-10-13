import { type BufferGeometry, Matrix4 } from 'three';
import * as v from 'valibot';
import { fetchBuildFile, readWholeGeometry } from '@wildshard/game/plugin/geometry';
import source from '../shard.config';
import world from '../data/world.generated.json' with { type: 'json' };
import { LayoutBake, type LayoutRows, LayoutRowsSchema, layoutReviver } from '../world/layoutBake';
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

async function geometries(refs: readonly string[], pause?: () => Promise<void>): Promise<Map<string, BufferGeometry>> {
  const owner = owners.at(-1);
  if (owner === undefined) throw new Error('Nine geometry reader was not installed');
  const views = await readWholeGeometry(owner, source, refs, pause), result = new Map<string, BufferGeometry>(), identity = new Matrix4();
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
  // `pause` between the assembled meshes: one tile's assembly in one task was the ~1.5 s iOS Simulator frame on the road
  const views = await geometries(refs, pause), indexed = new Map<number, BufferGeometry>();
  // The build file's URL is imported here, when the world hook reads it, so no module graph (Node's included) evaluates it.
  const { default: url } = await import('../data/layout.generated.json?url');
  const layout = await decodeNineLayout(await fetchBuildFile(url), pause);
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
/** Bytes of record text decoded per slice (~3,800 records). */
const RECORD_RUN = 32_768;
const HEAD = /^\{"version":1,"count":(\d{1,7}),"records":\[/u, COMMA = 0x2c, CLOSE = 0x5d;
const ROWS = ',"rows":';

/**
 * The layout build file (generators/bake-nine-layout.mjs, data/layout.generated.json): plain JSON `{"version":1,"count":n,"records":[…],"rows":{…}}`.
 * Its 689k float64 records are 6 MB of the 6.8 MB: they are decoded in runs of text with `pause` between them, each
 * token as JSON would read it (`Number` of a JSON number is the same double; '-0' and the infinities are revived as the
 * bake's replacer wrote them), into one Float64Array; the rows (0.8 MB) are one JSON.parse with the same reviver. Nothing
 * of it is module data, so no multi-MB parse runs at module evaluation (sp-o109; the imported JSON was a ~1.8 s iOS
 * Simulator frame on the road).
 */
export async function decodeNineLayout(bytes: Uint8Array, pause: () => Promise<void> = () => Promise.resolve()): Promise<{ rows: LayoutRows; records: Float64Array }> {
  const text = new TextDecoder('utf-8', { fatal: true }), head = HEAD.exec(text.decode(bytes.subarray(0, 64)));
  const count = Number(head?.[1] ?? Number.NaN), start = head?.[0].length ?? 0, end = bytes.indexOf(CLOSE, start);
  if (head === null || !(count <= RECORD_BOUND) || end === -1) throw new Error('Nine layout file header differs');
  const out = new Float64Array(count);
  let at = start, filled = 0;
  for (let run = 0; run < RECORD_BOUND; run++) {
    if (at >= end) break;
    let stop = Math.min(end, at + RECORD_RUN);
    if (stop < end) stop = bytes.lastIndexOf(COMMA, stop);
    if (stop <= at) throw new Error('Nine layout record run differs');
    const tokens = text.decode(bytes.subarray(at, stop)).split(',');
    for (let k = 0; k < Math.min(tokens.length, RECORD_RUN); k++) {
      const token = tokens[k] ?? '';
      const value = token.codePointAt(0) === 34 ? layoutReviver('', token.slice(1, -1)) : token.length === 0 ? Number.NaN : Number(token);
      if (typeof value !== 'number' || Number.isNaN(value) || filled >= count) throw new Error(`Nine layout record ${String(filled)} is not a number`);
      out[filled++] = value;
    }
    at = stop + 1;
    await pause();
  }
  if (filled !== count || text.decode(bytes.subarray(end + 1, end + 1 + ROWS.length)) !== ROWS || bytes.at(-1) !== 0x7d) throw new Error('Nine layout record count differs');
  const rows: unknown = JSON.parse(text.decode(bytes.subarray(end + 1 + ROWS.length, -1)), layoutReviver);
  await pause();
  return { rows: v.parse(LayoutRowsSchema, rows), records: out };
}

/** Lazy Explorer library and mandatory boot specimens use the same bounded standard GLB reader. */
export async function readNineSpecimens(part: SpecimenPart, pause?: () => Promise<void>): Promise<SpecimenBake> {
  const views = await geometries(world.libraries[part], pause);
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
