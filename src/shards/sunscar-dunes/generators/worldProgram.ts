import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { signalWorldMetadata, type SignalWorldMetadata } from './worldMetadata';
import { WORLD_BYTES } from './rows/files';
import { bakeSignalWorldSources } from './worldSources';

const input = 'assets/models/dry-well.glb';
const pieces = ['rocks', 'dressing', 'tower', 'caravan', 'well', 'braziers', 'lash'];
const names = [...pieces.flatMap(piece => [`${piece}.glb`, `${piece}.json`]), 'plait.bin'];

/** Cache the original world bake from its explicit model input, never from a generated piece or metadata file. */
export async function signalWorldFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'world-geometry', native: true, inputs: [input] }, async inputs => {
    const well = inputs.get(input);
    if (inputs.size !== 1 || well === undefined) throw new Error('Missing original well model');
    return (await bakeSignalWorldSources(well)).files;
  });
  if (files.size !== names.length || names.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('World geometry cache inventory differs');
  }
  return files;
}

/** All original world bytes and their validated metadata belong to this product. */
export interface SignalWorldProduct {
  readonly world: SignalWorldMetadata; readonly blobs: readonly NamedBlob[];
  readonly files: { readonly urls: Readonly<Record<string, string>>; readonly resources: readonly (Omit<(typeof WORLD_BYTES)[number], 'url'> & { readonly url: string })[] };
}
/** Admit the unchanged seven GLBs and deflated three-map plait companion. */
export async function signalWorld(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<SignalWorldProduct> {
  const files = await signalWorldFiles(ctx), world = signalWorldMetadata(files);
  const need = (name: string): Uint8Array => { const bytes = files.get(name); if (bytes === undefined) throw new Error('Missing world asset'); return bytes; };
  const blobs = pieces.map(name => nameBlob(`geometry/world/${name}.glb`, 'glb', need(`${name}.glb`)));
  // Three 128 x 128 RGBA maps, including their complete mip chains on the GPU.
  blobs.push(nameBlob('textures/plait.bin', 'bin', need('plait.bin'), { decoded: 196608, gpu: 262140 }));
  for (const blob of blobs) if (ctx.asset(blob.bytes) !== blob.file.hash) throw new Error('World asset publication differs');
  return { world, blobs, files: { urls: Object.fromEntries(pieces.map(name => [name, `geometry/world/${name}.glb`])),
    resources: WORLD_BYTES.map(row => ({ id: row.id, url: 'textures/plait.bin', compression: row.compression, fault: row.fault })) } };
}
