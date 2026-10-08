// SF67 fix 3 (E461): Driftwood's cover splat is baked at build (scripts/bake-island-cover.mjs). bake-check rebuilds the files
// byte for byte (the stale gate); this pins the format and the block round trip the page relies on.
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the committed bake files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test resolves the committed bake files.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { area } from '../src/shards/driftwood-isle/world/blenderArea';
import { decodeIslandCover, encodeIslandCover, islandCoverUrl } from '../src/shards/driftwood-isle/world/BlenderIsland';
import { CoverGrid } from '../src/shards/driftwood-isle/world/coverTint';

const ROOT = resolve(import.meta.dirname, '..');
const bytesOf = (b: Uint8Array): ArrayBuffer => { const out = new ArrayBuffer(b.byteLength); new Uint8Array(out).set(b); return out; };

describe('baked island cover (SF67)', () => {
  it('writes a splat block back bit for bit', () => {
    const a = new CoverGrid();
    a.splat([{ x: area.x0 + 3, z: area.z0 + 5, top: 0.4, side: 0.1, r: 0.2, g: 0.5, b: 0.1 }, { x: area.x1 - 7, z: area.z1 - 2, top: 0.05, side: 0.3, r: 0.6, g: 0.3, b: 0.2 }], area.x0, area.x1, area.z0, area.z1, 0.6);
    const block = a.readBlock(area.x0, area.x1, area.z0, area.z1);
    expect(block.length).toBe(a.blockLength(area.x0, area.x1, area.z0, area.z1));
    const b = new CoverGrid();
    b.data.fill(0.25); // whatever GroundCover filled: the splat overwrites the whole area
    const back = decodeIslandCover(bytesOf(encodeIslandCover(block, 7)), 7, block.length);
    expect(back).not.toBeNull();
    if (back === null) return;
    expect(b.writeBlock(back, area.x0, area.x1, area.z0, area.z1)).toBe(true);
    const c = new CoverGrid(); c.data.fill(0.25);
    c.splat([{ x: area.x0 + 3, z: area.z0 + 5, top: 0.4, side: 0.1, r: 0.2, g: 0.5, b: 0.1 }, { x: area.x1 - 7, z: area.z1 - 2, top: 0.05, side: 0.3, r: 0.6, g: 0.3, b: 0.2 }], area.x0, area.x1, area.z0, area.z1, 0.6);
    expect(new Uint8Array(b.data.buffer)).toEqual(new Uint8Array(c.data.buffer));
  });

  it('refuses a block that is not this build’s', () => {
    const block = new Float32Array(10).fill(0.5), file = bytesOf(encodeIslandCover(block, 3));
    expect(decodeIslandCover(file, 4, 10)).toBeNull(); // another placement count (the tier's cover share)
    expect(decodeIslandCover(file, 3, 11)).toBeNull(); // another rect
    expect(new CoverGrid().writeBlock(block, area.x0, area.x1, area.z0, area.z1)).toBe(false);
  });

  it('ships a bake for each tier that fits the area', () => {
    const floats = new CoverGrid().blockLength(area.x0, area.x1, area.z0, area.z1);
    for (const tier of ['phone', 'desktop'] as const) {
      const file = readFileSync(resolve(ROOT, 'public', islandCoverUrl(tier).slice(1)));
      const used = new DataView(bytesOf(file)).getUint32(8, true);
      expect(decodeIslandCover(bytesOf(file), used, floats)).not.toBeNull();
    }
  });
});
