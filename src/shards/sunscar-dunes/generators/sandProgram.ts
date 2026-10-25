import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { bakeSignalSandSources } from './sandSources';
import { signalSandMetadata, type SignalSandMetadata } from './sandMetadata';
import { SAND_ZSTD_LEVEL } from './sand';

const documents = ['sand/skirt.bin', 'sandMaps.json', 'sand.json', 'skirt.json'];
const texture = /^assets\/[a-f0-9]{64}$/u;

/** Cache the original procedural maps and skirt; no published output seeds the bake. */
export async function signalSandFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'sand-maps', native: true }, inputs => {
    if (inputs.size > 0) throw new Error('Unexpected sand bake input');
    return bakeSandSourceFiles();
  });
  if (files.size !== 7 || documents.some(name => (files.get(name)?.length ?? 0) === 0)
    || [...files].filter(([name, bytes]) => texture.test(name) && bytes.length > 0).length !== 3) {
    throw new Error('Sand cache inventory differs');
  }
  return files;
}

/** Encode the source cache through the pinned codecs without publishing files. */
export function bakeSandSourceFiles(): ReadonlyMap<string, Uint8Array> {
  return bakeSignalSandSources(bytes => encodeBuildBytes(bytes, 'deflate'),
    bytes => encodeBuildBytes(bytes, 'zstd', SAND_ZSTD_LEVEL));
}
/** Publish all three original library maps and bind their freshly verified metadata. */
export async function signalSand(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<SignalSandMetadata> {
  const files = await signalSandFiles(ctx), metadata = signalSandMetadata(files);
  for (const row of Object.values(metadata.maps)) {
    const bytes = files.get(`assets/${row.hash}`);
    if (bytes === undefined || ctx.asset(bytes) !== row.hash) throw new Error('Sand map publication differs');
  }
  return metadata;
}
