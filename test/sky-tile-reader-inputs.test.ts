import { withPortableMath } from '../src/commons/bake/portableMath';
import { originalSkyMovers } from './fixtures/sky-movers';
import { originalSkyNavigation } from './fixtures/sky-navigation';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldTileSource } from '../src/shards/far-reach/generators/worldTileBytes';
import { skyProductRows } from '../src/shards/far-reach/generators/product';

// T8 moves the same island channels from whole residency to named fine tile draws.
const declarationHash = '282a7d2bb522bcf61b2279ba4d52a3e4b161e009aeed6e66007e88e223bcc408';

test('the complete named tile metadata retains its publication contract', () => {
  const bytes = withPortableMath(skyWorldTileSource).get('data/props.json');
  if (bytes === undefined) throw new Error('Missing named island tile metadata');
  expect(hashImmutableBytes(bytes)).toBe('15cca111b5583251f8a967828065f83ece474d23ac0fa2932ad2be86aa825d0a');
});

test('the declaration pins complete streamed ownership and actual admission costs', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyProductRows(originalSkyNavigation(), originalSkyMovers()))}\n`);
  expect(bytes.byteLength).toBe(327_396);
  expect(hashImmutableBytes(bytes)).toBe(declarationHash);
});

test('declaration publication is retired and callers retain isolated complete original values', () => {
  const rows = skyProductRows(originalSkyNavigation(), originalSkyMovers()); rows.entryways.length = 0; rows.files.length = 0;
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(skyProductRows(originalSkyNavigation(), originalSkyMovers()))}\n`))).toBe(declarationHash);
});
