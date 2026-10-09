import { expect, it } from 'vitest';
import * as v from 'valibot';
import { pineWitness } from './native';

it('records the King and dawn from gameplay, retries a refused profile write, reopens it and rejects duplicates', () => {
  const result = pineWitness('ledger');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ compatible: false, ledger: { status: 'passed', resumedFrom: 'night',
    kingDefeated: true, dawn: true, gameplayEmissionProven: true, refusedWriteRetried: true,
    durableReload: true, duplicateStable: true } });
  const rows = v.parse(v.object({ ledger: v.object({ facts: v.array(v.object({ name: v.string() })) }) }), report);
  expect(rows.ledger.facts.map(row => row.name)).toContain('pine.feat.king');
  expect(rows.ledger.facts.map(row => row.name)).toContain('pine.feat.quest');
}, 60_000);
