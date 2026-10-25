import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { NineSourceWorld } from './worldProgram';
import { bakedLayout } from './layoutProjection';
import { worldRows, worldPartitionIds, parseWorldDeclarations, type NineWorldDeclarations } from './worldRows';
import { ND_AUDIO } from './audio';

const INPUTS = ['/assets/nine-dragon/lab/walker.glb', '/assets/nine-dragon/lab/sitter.glb'];
const encode = (value: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(value));

/** Original canonical declaration bytes, using this build's admitted layout and GLBs. */
export async function nineDeclarationFiles(world: NineSourceWorld, read: (url: string) => Uint8Array): Promise<Map<string, Uint8Array>> {
  const layout = bakedLayout(world.layout), rows = await worldRows(layout.rows, layout.records, read);
  const wholeTiles: NineWorldDeclarations['wholeTiles'] = {};
  const tiles = world.metadata.props?.tiles;
  if (!Array.isArray(tiles)) throw new Error('Nine declaration tiles are missing');
  const libraries: readonly (readonly [string, readonly string[]])[] = [...Object.entries(world.metadata.libraries),
    ['layout', tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? []))]];
  for (const [kind, hashes] of libraries) for (const hash of hashes) {
    const bytes = world.assets.get(hash); if (bytes === undefined) throw new Error(`Missing Nine source geometry ${hash}`);
    if (hashImmutableBytes(bytes) !== hash) throw new Error(`Nine source geometry differs ${hash}`);
    for (const id of worldPartitionIds(bytes)) {
      const row = wholeTiles[id] ??= { files: [], resident: false };
      if (!row.files.includes(hash)) row.files.push(hash);
      if (kind !== 'explorer') row.resident = true;
    }
  }
  return new Map([['declarations.json', encode({ audio: ND_AUDIO })], ['world-rows.json', encode({ ...rows, wholeTiles })]]);
}

/** Cache immutable wires outside source, keyed by the supplied world as well as program/input identity. */
export async function nineDeclarationsProgram(ctx: Pick<ProjectGenerationContext, 'cached'>, world: NineSourceWorld): Promise<{ readonly world: NineWorldDeclarations; readonly files: ReadonlyMap<string, Uint8Array> }> {
  const identity = hashImmutableBytes(encode({ metadata: world.metadata, layout: world.layout }));
  const files = await ctx.cached({ id: `declarations-${identity}`, inputs: INPUTS }, inputs => nineDeclarationFiles(world, url => {
    const bytes = inputs.get(url); if (bytes === undefined) throw new Error(`Missing Nine declaration input ${url}`); return bytes;
  }));
  const bytes = files.get('world-rows.json');
  if (files.size !== 2 || bytes === undefined || !files.has('declarations.json')) throw new Error('Nine declaration file inventory differs');
  const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (hashImmutableBytes(files.get('declarations.json') ?? new Uint8Array()) !== hashImmutableBytes(encode({ audio: ND_AUDIO }))) throw new Error('Nine audio declaration differs');
  return { world: parseWorldDeclarations(rows), files };
}
