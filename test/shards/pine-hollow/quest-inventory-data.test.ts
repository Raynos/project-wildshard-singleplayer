// oxlint-disable-next-line import/no-nodejs-modules -- Selects the defining checkout for the source-only authoring audit.
import process from 'node:process';
import { expect, it } from 'vitest';
import { PINE_FEATS, PINE_BAG_ITEMS, PINE_PACK_KINDS, PINE_PACK_SLOTS } from '../../../src/shards/pine-hollow/data/questInventory';
import { PINE_LEDGER } from '../../../src/shards/pine-hollow/data/ledger';
import { PINE_FEATS as legacyFeats } from '../../../src/shards/pine-hollow-legacy/feats';
import { PINE_ITEMS as legacyItems, PINE_PACK_KINDS as legacyKinds, PINE_PACK_SLOTS as legacySlots } from '../../../src/shards/pine-hollow-legacy/items';
import { auditAuthoringInputs } from '../../../scripts/authoring-inputs.mjs';

it('declares the same feat and bag values, order, glyphs and local-save ids as the frozen native source', () => {
  expect(PINE_FEATS).toStrictEqual(legacyFeats);
  expect(PINE_BAG_ITEMS).toStrictEqual(legacyItems);
  expect(PINE_PACK_KINDS).toStrictEqual(legacyKinds);
  expect(PINE_PACK_SLOTS).toBe(legacySlots);
  expect(PINE_LEDGER.map(row => row.rewards[0])).toStrictEqual(PINE_FEATS.map(row => ({
    kind: 'achievement', id: `pine-hollow.${row.id}`, title: row.title, threshold: row.count,
  })));
});

it('keeps the authored metadata independent of page, renderer, game and legacy modules', () => {
  const audit = auditAuthoringInputs(process.cwd(), 'pine-hollow', 'src/shards/pine-hollow/data/questInventory.ts');
  expect(audit.issues).toEqual([]);
  expect(audit.files).toEqual(['src/shards/pine-hollow/data/questInventory.ts']);
});
