import { Mesh, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import inventory from '../data/fixedGeometry.json' with { type: 'json' };
import { nativeSpecimenCatalogue } from './nativeSpecimens';

/** The trader's and the captain's native Explorer cards (GR7: the `driftwood-native-specimens` job's rows): the world-scene
 *  catalogue over their fixed draws and the owned library naming each draw's fixed blob. */
export interface DriftwoodNativeSpecimenBank {
  readonly catalogue: ReturnType<typeof nativeSpecimenCatalogue>;
  readonly library: { readonly id: 'native-specimens'; readonly kind: 'owned'; readonly models: { id: string; file: string; attributes: Record<string, string> }[] };
}

const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The fixed blob table's URL aliases and sources (`data/fixedBlobs.generated.json` among the fixed program's files). */
function fixedBlobRows(fixed: ReadonlyMap<string, Uint8Array>): { byUrl: Readonly<Record<string, string>>; sources: ReadonlyMap<string, string> } {
  const bytes = fixed.get('data/fixedBlobs.generated.json');
  if (bytes === undefined) throw new Error('Missing owned fixed blob rows');
  const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const byUrl = isRecord(rows) ? rows['byUrl'] : undefined, blobs = isRecord(rows) ? rows['blobs'] : undefined;
  if (!isRecord(byUrl) || !Array.isArray(blobs)) throw new Error('Invalid owned fixed blob rows');
  const names: Record<string, string> = {}, sources = new Map<string, string>();
  for (const [url, name] of Object.entries(byUrl)) if (typeof name === 'string') names[url] = name;
  for (const row of blobs as readonly unknown[]) if (isRecord(row) && typeof row['name'] === 'string' && typeof row['source'] === 'string') sources.set(row['name'], row['source']);
  return { byUrl: names, sources };
}

/** A draw's [from, to] custom-channel renames, checked (fixedGeometry.json types them loosely). */
function channelPairs(input: unknown): (readonly [string, string])[] {
  if (!Array.isArray(input)) throw new Error('Invalid native card channels');
  return (input as readonly unknown[]).map(row => {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string') throw new Error('Invalid native card channel');
    return [row[0], row[1]] as const;
  });
}

/** Decode each card's fixed draw (its one mesh, its custom channels renamed as the draw declares, as the owned geometry
 *  intake names them) and build the catalogue. */
export async function driftwoodNativeSpecimenBank(fixed: ReadonlyMap<string, Uint8Array>): Promise<DriftwoodNativeSpecimenBank> {
  const { byUrl, sources } = fixedBlobRows(fixed), groups = inventory.groups.npc, geometry = new Map<string, BufferGeometry>();
  const library: DriftwoodNativeSpecimenBank['library'] = { id: 'native-specimens', kind: 'owned', models: [] };
  try {
    for (const slot of new Set(['hat', 'cape', 'tradeCounter', ...Object.values(groups.trader)])) {
      const draw = inventory.draws.find(row => row.slot === slot);
      if (draw === undefined) throw new Error(`Missing native card draw: ${slot}`);
      const name = byUrl[draw.source], source = name === undefined ? undefined : sources.get(name), bytes = source === undefined ? undefined : fixed.get(source);
      if (name === undefined || bytes === undefined) throw new Error(`Missing native card blob: ${slot}`);
      const model = await readSourceModel(Uint8Array.from(bytes)), meshes: Mesh[] = [];
      model.gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
      const shape = meshes[0]?.geometry;
      if (shape === undefined) throw new Error(`Native card draw has no mesh: ${slot}`);
      const pairs = channelPairs(draw.channels), attributes: Record<string, string> = Object.fromEntries(pairs);
      for (const [from, to] of pairs) {
        const key = Object.keys(shape.attributes).find(candidate => candidate.toLowerCase() === from.toLowerCase());
        if (key !== undefined && key !== to) { shape.setAttribute(to, shape.getAttribute(key)); shape.deleteAttribute(key); }
      }
      geometry.set(slot, shape);
      library.models.push({ id: slot, file: name, attributes });
    }
    return { catalogue: nativeSpecimenCatalogue(geometry, groups), library };
  } finally { for (const shape of geometry.values()) shape.dispose(); }
}
