import { describe, expect, it, vi } from 'vitest';
import * as devMode from '../../src/engine/core/devMode';
import { registerGlobalDebugAction } from '../../src/engine/ui/authoredDebugRows';
import { levelDebugRows } from '../../src/engine/ui/debugOptions';
import { SHARDS } from '../../src/shards.generated';
import { toLevelSpec } from '../../src/game/shard/spec';

describe('global developer action lifecycle', () => {
  it('runs only on a press, remains global and makes discarded callbacks inert', async () => {
    const developer = vi.spyOn(devMode, 'isDev').mockReturnValue(false);
    let presses = 0;
    const register = () => registerGlobalDebugAction({ id: 'contract.global-action', group: 'tools', label: 'Contract action', text: 'Run',
      run: () => { presses++; }, note: 'E357: public action contract.', ask: 'E357', reviewBy: '2026-12-01' });
    const discard = register();
    const row = levelDebugRows().find((entry) => entry.id === 'contract.global-action');
    if (row?.action === undefined) throw new Error('Missing developer action');
    expect(presses).toBe(0);
    for (const manifest of SHARDS) expect(row.when({ chunk: toLevelSpec(manifest), weapons: new Set() })).toBe(true);
    await row.action.run(() => undefined); expect(presses).toBe(0);
    developer.mockReturnValue(true);
    await row.action.run(() => undefined); expect(presses).toBe(1);
    discard(); expect(levelDebugRows()).not.toContain(row);
    await row.action.run(() => undefined); expect(presses).toBe(1);
    const discardAgain = register(); expect(presses).toBe(1); discardAgain();
  });
});
