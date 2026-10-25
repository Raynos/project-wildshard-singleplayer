import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { bakeOwned, type BakedScene } from '@wildshard/sdk/bake';
import { signalDunesScene } from './scene';
import { signalTerrainSource } from './tiles';
import { facetModel, wellShell } from './facets';
import FACET_AO_FLOOR from '../data/facets.json' with { type: 'json' };
import { pieceRows } from './kinds';
import { bakeSignalLash, plaitTexels } from './lash';

/** Build the original world and held lash from owned author input; publication is the caller's job. */
export async function bakeSignalWorldSources(wellBytes: Uint8Array): Promise<{ files: ReadonlyMap<string, Uint8Array>; world: BakedScene }> {
  const world = bakeOwned(signalDunesScene(wellShell(await facetModel(wellBytes, FACET_AO_FLOOR))),
    { slug: 'sunscar-dunes', name: 'Signal Dunes' }, { terrain: signalTerrainSource() });
  const files = new Map<string, Uint8Array>();
  const json = (name: string, value: unknown): void => { files.set(name, new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`)); };
  for (const part of world.pieces) {
    const name = part.name.replace(/^sunscar\./u, ''), { glb, ...rows } = pieceRows(part);
    files.set(`${name}.glb`, glb);
    json(`${name}.json`, { glb: hashImmutableBytes(glb), ...rows });
  }
  const { glb, ...rows } = bakeSignalLash();
  files.set('lash.glb', glb);
  json('lash.json', { glb: hashImmutableBytes(glb), ...rows });
  const texels = plaitTexels();
  const plait = await new Response(new Blob([new Uint8Array(texels)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
  files.set('plait.bin', new Uint8Array(plait));
  return { files, world };
}
