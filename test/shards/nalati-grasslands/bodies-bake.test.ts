import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs the byte-exact half where the bake was made.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { setLowPoly } from '@wildshard/engine/entities/species/loft';
import { Rng } from '@wildshard/engine/core/rng';
import { NALATI_BODY_ROWS, nalatiBody, unshuffleBodyLanes, useNalatiBodies } from '../../../src/shards/nalati-grasslands/species/bodies';
import { bodyVariants, geometryRow } from '../../../src/shards/nalati-grasslands/generators/bodies';
import { bodyKey } from '../../../src/shards/nalati-grasslands/species/bodyKey';
import { HORSE_SPECIES } from '../../../src/shards/nalati-grasslands/species/horse';
import { WOLF_SPECIES } from '../../../src/shards/nalati-grasslands/species/wolf';
import { bakeBodyRows } from '../../../scripts/bake-nalati-bodies.mjs';

const shipped = (): Uint8Array => unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/nalati/baked/bodies.bin', import.meta.url)))));
/** byte-for-byte equality (12 MB: toEqual would print the whole buffer on a miss) */
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
describe("Nalati bakes its species bodies offline (SHARD-PLATFORM M3)", () => {
  // Math.sin / hypot in the lofts and the paint: byte-exact where the bake was made (macOS)
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-nalati-bodies.mjs)', () => {
    const { rows, bin } = bakeBodyRows();
    expect(rows).toEqual(NALATI_BODY_ROWS);
    expect(same(shipped(), bin)).toBe(true);
  }, 60_000);

  it("the page's build() hands back every body bit-exact: its parts re-encode to the committed bytes, in both resolutions", () => {
    const raw = shipped();
    useNalatiBodies(raw);
    const looks = { horse: HORSE_SPECIES.build, canid: WOLF_SPECIES.build }, blocks: Uint8Array[] = [], seen = new Set<string>();
    for (const lowPoly of [false, true]) {
      for (const { family, variant } of bodyVariants()) {
        const key = bodyKey(family, variant, lowPoly), row = NALATI_BODY_ROWS.bodies.find((b) => b.key === key);
        if (seen.has(key)) continue;
        seen.add(key);
        setLowPoly(lowPoly);
        try {
          const body = looks[family](variant, new Rng(7));
          expect(row?.bones).toEqual(body.bones);
          expect(row?.dims).toEqual(body.dims);
          for (const g of [...body.furParts, ...body.hardParts, ...body.eyeParts]) geometryRow(g, blocks);
        } finally { setLowPoly(false); }
      }
    }
    const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of blocks) { out.set(b, at); at += b.length; }
    expect(out.length).toBe(raw.length);
    expect(same(out, raw)).toBe(true);
  });

  it('decodes every row, and an unbaked variant faults by name', () => {
    useNalatiBodies(shipped());
    expect(NALATI_BODY_ROWS.bodies.length).toBeGreaterThan(20);
    for (const { family, variant } of bodyVariants()) expect(nalatiBody(family, variant).furParts.length).toBeGreaterThan(0);
    expect(() => nalatiBody('horse', { id: 'x', label: 'x', weight: 0, rarity: 'common', scale: [1, 1], traits: { tack: 7 } })).toThrow(/no baked body/u);
  });
});
