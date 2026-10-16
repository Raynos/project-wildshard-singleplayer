import { expect, it } from 'vitest';
import { latestLaneCommit } from '../scripts/lane-watchdog.mjs';

const older = '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const newer = '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const other = '3333333ccccccccccccccccccccccccccccccccc';
const record = (sha: string, seconds: number, body = '') => `${sha}\0${seconds}\0Jake\0${body}\nAssisted-by: Codex:gpt-6.1-sol\u001E`;
const history = record(other, 300) + record(newer, 200) + record(older, 100);
const ledger = new Map([[older, 'pane-x7']]);

it('credits each lane only for its own verified report despite identical authors and trailers', () => {
  const text = `• LANDED \`${newer.slice(0, 9)}\` — pushed, checks green\n`;
  expect(latestLaneCommit(history, text, 'sp-x7', 'pane-x7', ledger)).toMatchObject({ sha: newer, at: 200_000 });
  expect(latestLaneCommit(history, `PUSHED ${other}`, 'sp-x8', 'pane-x8', ledger)).toMatchObject({ sha: other, at: 300_000 });
  expect(latestLaneCommit(history, '', 'sp-x5', 'pane-x5', ledger)).toBeUndefined();
  // Losing the visible report on the next poll must not fall back to the older ledger entry.
  expect(latestLaneCommit(history, '• Working', 'sp-x7', 'pane-x7', ledger, newer)).toMatchObject({ sha: newer, at: 200_000 });
});

it('rejects uncommitted/ambiguous hashes and incoming peer messages or ordinary mentions', () => {
  const text = `› [from sp-x8] LANDED ${other}\n  LANDED ${other}\n• I verified ${other} on origin\n> PUSHED ${other}\nLANDED deadbeef\n`;
  expect(latestLaneCommit(history, text, 'sp-x7', 'pane-x7', ledger)).toMatchObject({ sha: older });
  const ambiguous = record('2222222ccccccccccccccccccccccccccccccccc', 400) + history;
  expect(latestLaneCommit(ambiguous, 'LANDED 2222222', 'sp-x7', 'pane-x7', ledger)).toMatchObject({ sha: older });
  expect(latestLaneCommit(record(newer, 200, 'Thanks sp-x7 for the help'), '', 'sp-x7', 'pane-x7', new Map())).toBeUndefined();
});
