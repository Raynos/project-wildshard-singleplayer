import { describe, expect, it } from 'vitest';
import { registerGlobalDebugAction } from '#engine';
import { levelDebugRows } from '#engine/ui/debugOptions';
import { SHARDS } from '../../src/shards.generated';
import { toLevelSpec } from '#game';

describe('global developer action lifecycle', () => {
  it('runs only on a press, remains global and makes discarded callbacks inert', async () => {
    let presses = 0;
    const register = () => registerGlobalDebugAction({ id: 'contract.global-action', group: 'tools', label: 'Contract action', text: 'Run',
      run: () => { presses++; }, note: 'E357: public action contract.', ask: 'E357', reviewBy: '2026-12-01' });
    const discard = register();
    const row = levelDebugRows().find((entry) => entry.id === 'contract.global-action');
    if (row?.action === undefined) throw new Error('Missing developer action');
    expect(presses).toBe(0);
    for (const manifest of SHARDS) expect(row.when({ chunk: toLevelSpec(manifest), weapons: new Set() })).toBe(true);
    await row.action.run(() => undefined); expect(presses).toBe(1);
    discard(); expect(levelDebugRows()).not.toContain(row);
    await row.action.run(() => undefined); expect(presses).toBe(1);
    const discardAgain = register(); expect(presses).toBe(1); discardAgain();
  });
});
