import { expect, it } from 'vitest';
import * as format from '@wildshard/format/contentBounds';
import * as engine from '../src/engine/core/config';

it('keeps existing engine cell/content bindings identical to their format definitions', () => {
  for (const [name, host, author] of [
    ['CHUNK_SIZE', engine.CHUNK_SIZE, format.CHUNK_SIZE],
    ['CHUNK_HALF', engine.CHUNK_HALF, format.CHUNK_HALF],
    ['ENTRY_WIDTH', engine.ENTRY_WIDTH, format.ENTRY_WIDTH],
    ['ENTRY_ASPHALT', engine.ENTRY_ASPHALT, format.ENTRY_ASPHALT],
    ['CELL_HEIGHT', engine.CELL_HEIGHT, format.CELL_HEIGHT],
    ['CELL_BELOW', engine.CELL_BELOW, format.CELL_BELOW],
    ['CELL_ABOVE', engine.CELL_ABOVE, format.CELL_ABOVE],
    ['CONTENT_MB', engine.CONTENT_MB, format.CONTENT_MB],
    ['CONTENT_CAPS', engine.CONTENT_CAPS, format.CONTENT_CAPS],
  ] as const) {
    expect(Object.is(host, author), name).toBe(true);
  }
});
