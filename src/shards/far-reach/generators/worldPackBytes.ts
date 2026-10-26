import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { bakeSkyBridges } from './bridges';
import { bakeSkyIsles } from './isles';
import { bakeSkyMillModel } from './millModel';
import { HD_URLS, MODEL_URLS } from './fileInventory';

/** The original model reads, independent of published geometry handoffs. */
export const WORLD_PACK_INPUTS: readonly string[] = [MODEL_URLS['bridge-deck'], HD_URLS['mill-tower'], HD_URLS['mill-foot']];
/** Exact logical output inventory shared by the source cache and retained writer. */
export const WORLD_PACK_FILES: readonly string[] = ['baked/bridges.bin', 'data/bridges.json', 'baked/isles.bin', 'data/isles.json', 'baked/mill-model.bin', 'data/millModel.json'];

/** Serialize one original pack pair without publishing files; compression remains caller-owned. */
export function skyWorldPackFiles(name: 'bridges' | 'isles' | 'mill-model', pack: { readonly bin: Uint8Array; readonly rows: object },
  compress: (bytes: Uint8Array) => Uint8Array): Map<string, Uint8Array> {
  const document = name === 'mill-model' ? 'millModel' : name;
  return new Map([
    [`baked/${name}.bin`, compress(pack.bin)],
    [`data/${document}.json`, new TextEncoder().encode(`${JSON.stringify({ pack: hashImmutableBytes(pack.bin), ...pack.rows })}\n`)],
  ]);
}

/** Compile the original three packs and ordered JSON rows; the caller supplies native compression. */
export async function skyWorldPackSource(inputs: ReadonlyMap<string, Uint8Array>, compress: (bytes: Uint8Array) => Uint8Array): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== WORLD_PACK_INPUTS.length || WORLD_PACK_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky world pack input inventory differs');
  }
  const read = (name: string): Uint8Array => {
    const bytes = inputs.get(name); if (bytes === undefined) throw new Error(`Missing Sky pack source ${name}`); return bytes;
  };
  const bridges = await bakeSkyBridges(read), isles = bakeSkyIsles(), mill = await bakeSkyMillModel(read);
  const files = new Map<string, Uint8Array>();
  for (const [name, pack] of [['bridges', bridges], ['isles', isles], ['mill-model', mill]] as const) {
    for (const [file, bytes] of skyWorldPackFiles(name, pack, compress)) files.set(file, bytes);
  }
  return files;
}
