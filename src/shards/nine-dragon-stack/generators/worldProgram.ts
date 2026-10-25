import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { nineWorldProduct, nineLayoutWord } from './worldProduct';
import { parseWorldHeader, parseWorldLayout } from './sections';
import { bakedLayout } from './layoutProjection';

function admitWorld(value: unknown) {
  const header = parseWorldHeader(value);
  const checked = parseShardfile({ ...emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a }),
    ...header.shardfile, props: header.props });
  return { ...header, shardfile: { tiles: checked.tiles, files: checked.files, critical: checked.critical, far: checked.far, library: checked.library }, props: checked.props };
}
function admitLayout(value: unknown) {
  const wire = parseWorldLayout(value);
  return { ...wire, ...bakedLayout(wire) };
}
/** One invocation's admitted world rows and all original immutable geometry bytes. */
export interface NineSourceWorld {
  readonly metadata: ReturnType<typeof admitWorld>;
  readonly layout: ReturnType<typeof admitLayout>;
  readonly assets: ReadonlyMap<string, Uint8Array>;
}

/** Cache exact predecessor wires and raw GLBs outside source; every hit retains ordinary admission and publication. */
export async function nineWorldProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<NineSourceWorld> {
  const files = await ctx.cached({ id: 'world-layout' }, () => {
    const product = nineWorldProduct();
    const encode = (value: unknown, suffix = ''): Uint8Array => new TextEncoder().encode(JSON.stringify(value, nineLayoutWord) + suffix);
    return new Map([['world.json', encode(product.metadata, '\n')], ['layout.json', encode(product.layout)],
      ...[...product.assets].map(([hash, bytes]) => [`blobs/${hash}`, bytes] as const)]);
  });
  const read = (name: string): unknown => {
    const bytes = files.get(name); if (bytes === undefined) throw new Error(`Missing owned Nine world ${name}`);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  };
  const metadata = admitWorld(read('world.json')), layout = admitLayout(read('layout.json')), assets = new Map<string, Uint8Array>();
  if (files.size !== metadata.shardfile.files.length + 2) throw new Error('Nine world file inventory differs');
  for (const row of metadata.shardfile.files) {
    const bytes = files.get(`blobs/${row.hash}`);
    if (bytes === undefined || bytes.byteLength !== row.compressed || hashImmutableBytes(bytes) !== row.hash) throw new Error(`Nine world bytes differ: ${row.hash}`);
    if (ctx.asset(bytes) !== row.hash) throw new Error('Nine world publication differs');
    assets.set(row.hash, bytes);
  }
  return { metadata, layout, assets };
}
