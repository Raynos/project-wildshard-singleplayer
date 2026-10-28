import { withPortableMath } from '../src/commons/bake/portableMath';
import { originalSkyMovers } from './fixtures/sky-movers';
import { originalSkyNavigation } from './fixtures/sky-navigation';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldTileSource } from '../src/shards/far-reach/generators/worldTileBytes';
import { skyProductRows } from '../src/shards/far-reach/generators/product';

// T8 moves the same island channels from whole residency to named fine tile draws.
// FR2: + `"ring":"cell",` (14 B), Sky's whole-cell tile ring
const declarationHash = 'b95a12c23cde905f3543f47eeade4e5c3bc8110de760b97af8be9064887de76e';

test('the complete named tile metadata retains its publication contract', () => {
  const bytes = withPortableMath(skyWorldTileSource).get('data/props.json');
  if (bytes === undefined) throw new Error('Missing named island tile metadata');
  expect(hashImmutableBytes(bytes)).toBe('56347c7c23df434bb6cbcc79dca5fccc873dd445b2ddc00420af51ceb4314662');
});

test('the declaration pins complete streamed ownership and actual admission costs', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyProductRows(originalSkyNavigation(), originalSkyMovers()))}\n`);
  expect(bytes.byteLength).toBe(327_410);
  expect(hashImmutableBytes(bytes)).toBe(declarationHash);
});

test('declaration publication is retired and callers retain isolated complete original values', () => {
  const rows = skyProductRows(originalSkyNavigation(), originalSkyMovers()); rows.entryways.length = 0; rows.files.length = 0;
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(skyProductRows(originalSkyNavigation(), originalSkyMovers()))}\n`))).toBe(declarationHash);
});
