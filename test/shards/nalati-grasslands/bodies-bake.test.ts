import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs the byte-exact half where the bake was made.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { Rng } from '@wildshard/engine/core/rng';
import { NALATI_BODY_ROWS, nalatiBody, unshuffleBodyLanes, useNalatiBodies } from '../../../src/shards/nalati-grasslands/species/bodies';
import { bakeBody, distinctBodies, geometryRow } from '../../../src/shards/nalati-grasslands/generators/bodies';
import { bodyKey } from '../../../src/shards/nalati-grasslands/species/bodyKey';
import { HORSE_SPECIES } from '../../../src/shards/nalati-grasslands/species/horse';
import { WOLF_SPECIES } from '../../../src/shards/nalati-grasslands/species/wolf';

const shipped = (): Uint8Array => unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/nalati/baked/bodies.bin', import.meta.url)))));
/** byte-for-byte equality (MBs: toEqual would print the whole buffer on a miss) */
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const joined = (blocks: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of blocks) { out.set(b, at); at += b.length; }
  return out;
};
const looks = { horse: HORSE_SPECIES.build, canid: WOLF_SPECIES.build };
describe("Nalati bakes its species bodies offline (SHARD-PLATFORM M3)", () => {
  // The full stale gate is `scripts/bake-nalati-bodies.mjs --check` (bake-check's node baker, every body). Here: the lofts
  // on one horse and one canid (the first of each family's rows) against the committed bytes the page reads back.
  // Math.sin / hypot in the lofts and the paint: byte-exact where the bake was made (macOS)
  it.runIf(platform === 'darwin')('a horse and a canid rebake byte-exact to the committed bodies (rerun scripts/bake-nalati-bodies.mjs)', () => {
    useNalatiBodies(shipped());
    for (const family of ['horse', 'canid'] as const) {
      const pick = distinctBodies().find((b) => b.family === family);
      if (pick === undefined) throw new Error(`no ${family} body`);
      const baked: Uint8Array[] = [], read: Uint8Array[] = [], row = bakeBody(family, pick.variant, baked);
      expect(row).toEqual(NALATI_BODY_ROWS.bodies.find((b) => b.key === row.key));
      const body = nalatiBody(family, pick.variant);
      for (const g of [...body.furParts, ...body.hardParts, ...body.eyeParts]) geometryRow(g, read);
      expect(same(joined(baked), joined(read))).toBe(true);
    }
  });

  it("the page's build() hands back every body bit-exact: its parts re-encode to the committed bytes", () => {
    const raw = shipped();
    useNalatiBodies(raw);
    const blocks: Uint8Array[] = [], bodies = distinctBodies();
    expect(bodies.map(({ family, variant }) => bodyKey(family, variant))).toEqual(NALATI_BODY_ROWS.bodies.map((b) => b.key));
    for (const { family, variant } of bodies) {
      const body = looks[family](variant, new Rng(7)), row = NALATI_BODY_ROWS.bodies.find((b) => b.key === bodyKey(family, variant));
      expect(row?.bones).toEqual(body.bones);
      expect(row?.dims).toEqual(body.dims);
      for (const g of [...body.furParts, ...body.hardParts, ...body.eyeParts]) geometryRow(g, blocks);
    }
    expect(same(joined(blocks), raw)).toBe(true);
  });

  it('decodes every row, and an unbaked variant faults by name', () => {
    useNalatiBodies(shipped());
    expect(NALATI_BODY_ROWS.bodies.length).toBeGreaterThan(20);
    for (const { family, variant } of distinctBodies()) expect(nalatiBody(family, variant).furParts.length).toBeGreaterThan(0);
    expect(() => nalatiBody('horse', { id: 'x', label: 'x', weight: 0, rarity: 'common', scale: [1, 1], traits: { tack: 7 } })).toThrow(/no baked body/u);
  });
});
