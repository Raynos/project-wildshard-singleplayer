// oxlint-disable-next-line import/no-nodejs-modules -- Selects the defining checkout for the source-only authoring audit.
import process from 'node:process';
import { expect, it } from 'vitest';
import { WARDENS_HOLLOW, QUEST_DONE, QUEST_EXTERNAL, LANTERN_FLAGS, ERRAND_EXTERNAL, RANGER_DIALOGUE, MILLER_DIALOGUE, TRADER_DIALOGUE } from '../../../src/shards/pine-hollow/data/wardensHollow';
import { RANGER, MILLER, TRADER } from '../../../src/shards/pine-hollow/quest/wardensHollow';
import * as legacy from '../../../src/shards/pine-hollow-legacy/quest/wardensHollow';
import { auditAuthoringInputs } from '../../../scripts/authoring-inputs.mjs';

it('declares the exact seven-step quest, external flag order and all three native dialogue trees', () => {
  expect(WARDENS_HOLLOW).toStrictEqual(legacy.WARDENS_HOLLOW);
  expect(QUEST_DONE).toBe(legacy.QUEST_DONE);
  expect(QUEST_EXTERNAL).toStrictEqual(legacy.QUEST_EXTERNAL);
  expect(LANTERN_FLAGS).toStrictEqual(legacy.LANTERN_FLAGS);
  expect(ERRAND_EXTERNAL).toStrictEqual(legacy.ERRAND_EXTERNAL);
  for (const [authored, admitted, frozen] of [
    [RANGER_DIALOGUE, RANGER, legacy.RANGER],
    [MILLER_DIALOGUE, MILLER, legacy.MILLER],
    [TRADER_DIALOGUE, TRADER, legacy.TRADER],
  ]) {
    expect(authored).toStrictEqual(frozen);
    expect(admitted).toStrictEqual(frozen);
  }
});

it('keeps every quest and dialogue declaration in the authoring closure', () => {
  const audit = auditAuthoringInputs(process.cwd(), 'pine-hollow', 'src/shards/pine-hollow/data/wardensHollow.ts');
  expect(audit.issues).toEqual([]);
  expect(audit.files).toContain('src/shards/pine-hollow/data/wardensHollow.ts');
  expect(audit.files.some(file => file.startsWith('src/game/') || file.startsWith('src/engine/'))).toBe(false);
});
