import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { GridAssembly } from '../src/game/grid/assembly';
import { readGridEdges } from '../src/game/grid/edgeSources';

it('takes exact turn-in widths from admitted declarations and never invents an entry from flat legacy boundary heights', async () => {
  const grid = new GridAssembly({ developer: false, devserver: false }), cell = grid.cells.find(row => row.slug === '_template');
  if (cell === undefined) throw new Error('Missing template cell');
  const source = emptyShardfile({ slug: 'template', name: 'Template', author: 'Fixture', revision: 1, seed: 1 });
  const admitted = await readGridEdges(cell, { product: () => Promise.resolve({ admitted: { source } }), fetch: () => Promise.reject(new Error('Admitted profiles never fetch legacy terrain')) });
  expect(Object.values(admitted.observations).map(row => row.entryWidth)).toEqual([8, 8, 8, 8]);
  const bytes = new Uint8Array(24 + 256 ** 2 * 4), header = new DataView(bytes.buffer);
  header.setUint32(0, 0x52545357, true); header.setUint32(4, 1, true); header.setUint32(8, 256, true); header.setFloat32(12, 500, true);
  const legacy = await readGridEdges(cell, { product: () => null, fetch: () => Promise.resolve(new Response(bytes)) });
  expect(Object.values(legacy.observations).map(row => row.entryWidth)).toEqual([0, 0, 0, 0]);
});
