import { readFileSync } from 'node:fs';
import { driftwoodFixedBytes, DRIFTWOOD_FIXED_INPUTS } from '../../src/shards/driftwood-isle/generators/fixedProgram';

let files: Promise<ReadonlyMap<string, Uint8Array>> | undefined;
/** Original fixed files come from the defining producer over committed native inputs. */
export function driftwoodFixedBank(): Promise<ReadonlyMap<string, Uint8Array>> {
  files ??= driftwoodFixedBytes(new Map(DRIFTWOOD_FIXED_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))])));
  return files;
}

/** A template's original bytes, before product packing, without a copied public output. */
export async function driftwoodFixedModel(name: string): Promise<Uint8Array> {
  const bytes = (await driftwoodFixedBank()).get(`baked/fixed-models/${name}.glb`);
  if (bytes === undefined) throw new Error(`Missing owned fixed model: ${name}`);
  return bytes;
}

/** Hash-bound tile, terrain and template assets, including the native coarse parents. */
export async function driftwoodFixedAssets(): Promise<ReadonlyMap<string, Uint8Array>> {
  const assets = new Map<string, Uint8Array>();
  for (const [name, bytes] of await driftwoodFixedBank()) {
    if (name.startsWith('assets/')) assets.set(name.slice('assets/'.length), bytes);
    if (name.startsWith('owned/coarse/') && name.endsWith('.glb')) assets.set(name.slice('owned/coarse/'.length, -4), bytes);
  }
  return assets;
}
