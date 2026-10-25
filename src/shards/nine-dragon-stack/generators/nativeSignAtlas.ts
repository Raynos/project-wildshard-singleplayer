import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseNativeSignAtlas, type NineNativeAtlas } from './signAtlasOutput';

/** Native assets keep logical names; their declared input paths belong to the author CLI. */
export interface NineNativeAtlasFile {
  readonly name: string;
  readonly input: string;
  readonly bytes: number;
  readonly hash: string;
}
export interface NineNativeAtlasSource {
  readonly atlas: NineNativeAtlas;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

function checkInventory(reference: readonly NineNativeAtlasFile[]): void {
  if (reference.length !== 7 || new Set(reference.map(row => row.name)).size !== 7 || new Set(reference.map(row => row.input)).size !== 7
    || reference.some(row => !/^[a-zA-Z0-9.-]+$/u.test(row.name) || !/^[a-f0-9]{64}$/u.test(row.hash)
      || !Number.isSafeInteger(row.bytes) || row.bytes <= 0)) throw new Error('Nine native atlas inventory differs');
}

/** Admit every original native byte before using its metadata or geometry ranges. */
export function admitNativeSignAtlas(files: ReadonlyMap<string, Uint8Array>, reference: readonly NineNativeAtlasFile[]): NineNativeAtlasSource {
  checkInventory(reference);
  if (files.size !== reference.length) throw new Error('Nine native atlas file inventory differs');
  for (const row of reference) {
    const bytes = files.get(row.name);
    if (bytes === undefined || bytes.byteLength !== row.bytes || hashImmutableBytes(bytes) !== row.hash) throw new Error(`Nine native atlas bytes differ: ${row.name}`);
  }
  const metadata = files.get('signAtlas.generated.json');
  if (metadata === undefined) throw new Error('Missing Nine native atlas metadata');
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  const atlas = parseNativeSignAtlas(input), names = new Set(['signAtlas.generated.json']);
  for (const tier of ['phone', 'desktop'] as const) {
    const row = atlas[tier], buffer = files.get(row.buffer);
    for (const name of [row.buffer, row.mono.packed, row.colour.packed]) {
      if (names.has(name) || !files.has(name)) throw new Error('Nine native atlas references differ');
      names.add(name);
    }
    if (buffer === undefined) throw new Error('Missing Nine native atlas geometry');
    const check = (range: { byteOffset: number; byteLength: number }): void => {
      if (range.byteOffset % 4 !== 0 || range.byteLength % 4 !== 0 || range.byteOffset + range.byteLength > buffer.byteLength) throw new Error('Nine native atlas geometry range differs');
    };
    for (const geometry of Object.values(row.geometries)) {
      check(geometry.index);
      for (const attribute of Object.values(geometry.attributes)) check(attribute.data);
    }
  }
  if (names.size !== reference.length) throw new Error('Nine native atlas reference inventory differs');
  return { atlas, files };
}

/** Hits still read every declared asset and re-admit all seven immutable native files. */
export async function nineNativeSignAtlas(ctx: Pick<ProjectGenerationContext, 'cached'>, reference: readonly NineNativeAtlasFile[]): Promise<NineNativeAtlasSource> {
  checkInventory(reference);
  const files = await ctx.cached({ id: 'native-sign-atlas', inputs: reference.map(row => row.input) }, inputs => new Map(reference.map(row => {
    const bytes = inputs.get(row.input); if (bytes === undefined) throw new Error(`Missing Nine native atlas input ${row.input}`);
    return [row.name, bytes];
  })));
  return admitNativeSignAtlas(files, reference);
}
