// oxlint-disable-next-line import/no-nodejs-modules -- Admit the committed native fixture bytes from their declared public inputs.
import { readFileSync } from 'node:fs';
import inputs from '../../src/shards/nine-dragon-stack/data/nativeSignAtlas.json' with { type: 'json' };
import { admitNativeSignAtlas } from '../../src/shards/nine-dragon-stack/generators/nativeSignAtlas';

/** The same seven checked native files supplied by the real product entry. */
export const nativeSignAtlas = admitNativeSignAtlas(new Map(inputs.map(row => [row.name,
  new Uint8Array(readFileSync(`public${row.input}`))])), inputs);
