// oxlint-disable-next-line import/no-nodejs-modules -- Selects the defining checkout for the source-only authoring audit.
import process from 'node:process';
import { expect, it } from 'vitest';
import { CONTRACT_ROWS, ELITE_TARGETS } from '../../../src/shards/pine-hollow/data/contractRows';
import { TRADES } from '../../../src/shards/pine-hollow/data/trades';
import { draw, newBoard, claim, reroll, recordKill } from '../../../src/shards/pine-hollow/quest/contracts';
import * as legacy from '../../../src/shards/pine-hollow-legacy/quest/contracts';
import { TRADES as legacyTrades } from '../../../src/shards/pine-hollow-legacy/quest/trades';
import { auditAuthoringInputs } from '../../../scripts/authoring-inputs.mjs';

it('authors every lodge offer and trader swap with exact native identities, costs and reward order', () => {
  expect(TRADES).toStrictEqual(legacyTrades);
  expect(ELITE_TARGETS).toStrictEqual(legacy.ELITE_TARGETS);
  for (const row of CONTRACT_ROWS) {
    const native = legacy.contractFor(0, row.kind, row.target);
    expect(native).toStrictEqual({ serial: 0, have: 0, kind: row.kind, target: row.target,
      need: row.need, title: row.title, goal: row.goal, reward: row.reward });
  }
  for (const path of ['contractRows', 'trades']) {
    expect(auditAuthoringInputs(process.cwd(), 'pine-hollow', `src/shards/pine-hollow/data/${path}.ts`).issues).toEqual([]);
  }
});

it('preserves the real deterministic board, overlapping kill, claim and reroll suffix without mutating authored rows', () => {
  const authored = JSON.stringify(CONTRACT_ROWS), board = newBoard(), frozen = legacy.newBoard();
  expect(board).toStrictEqual(frozen);
  for (let serial = 0; serial < 500; serial++) expect(draw(serial)).toStrictEqual(legacy.draw(serial));
  for (let tick = 0; tick < 60; tick++) {
    const slot = tick % 3;
    const kill = { kind: tick % 2 === 0 ? 'deer' : 'boar', variant: 'ironhide', rarity: 'rare', elite: 'ironhide', thrall: tick % 4 === 0 };
    expect(recordKill(board, kill)).toStrictEqual(legacy.recordKill(frozen, kill));
    if (tick % 3 === 0) expect(claim(board, slot)).toStrictEqual(legacy.claim(frozen, slot));
    if (tick % 5 === 0) { reroll(board, slot); legacy.reroll(frozen, slot); }
    expect(board).toStrictEqual(frozen);
  }
  expect(JSON.stringify(CONTRACT_ROWS)).toBe(authored);
});
