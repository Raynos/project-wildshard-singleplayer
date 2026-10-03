// The ask and plan rules (E423, docs/process/ASKS.md): scripts/asks.mjs.
import { describe, expect, it } from 'vitest';
import { checkAsk, parseAsk, planVerdict } from '../scripts/asks.mjs';

const ask = (status: string, extra = '') => `# E9\n\n**Status:** ${status}\n**Ask:** do the thing\n${extra}`;
const known = (path: string) => path === 'docs/tasks/asks/E5.md' || path === 'docs/plans/NINE-DRAGON-STACK.md';

describe('parseAsk', () => {
  it('reads the state, date, fold target and handoffs', () => {
    const a = parseAsk(ask('folded into E5 (2026-10-03, E423)', '\n## Handoff (lane a)\n'));
    expect(a).toMatchObject({ state: 'folded into', closed: true, target: 'E5', date: '2026-10-03', handoffs: ['(lane a)'] });
    expect(parseAsk(ask('needs you')).state).toBeNull();
  });
});

describe('checkAsk', () => {
  it('passes the vocabulary', () => {
    for (const s of ['open (2026-10-03)', 'in flight (2026-10-03, wildshard-12)', 'needs pick (2026-10-03)', 'done (2026-10-03)',
      'dropped (2026-10-03): why', 'folded into E5', 'superseded by NINE-DRAGON-STACK']) {
      expect(checkAsk('E9', ask(s), known), s).toEqual([]);
    }
  });

  it('refuses a status outside it, a claim with no owner, and a fold with no target', () => {
    expect(checkAsk('E9', ask('needs you (2026-10-03)'), known)).toHaveLength(1);
    expect(checkAsk('E9', ask('in flight (2026-10-03)'), known)).toHaveLength(1);
    expect(checkAsk('E9', ask('folded into E77'), known)).toHaveLength(1);
    expect(checkAsk('E8', ask('done'), known)).toHaveLength(1);
  });

  it('allows one live handoff per lane, and none once the ask is closed', () => {
    expect(checkAsk('E9', ask('open (2026-10-03)', '## Handoff (a)\n## Handoff (b)\n'), known)).toEqual([]);
    expect(checkAsk('E9', ask('open (2026-10-03)', '## Handoff (a)\n## Handoff (a)\n'), known)).toHaveLength(1);
    expect(checkAsk('E9', ask('done (2026-10-03)', '## Handoff (a)\n'), known)).toHaveLength(1);
  });
});

describe('planVerdict', () => {
  const plans = ['NINE-DRAGON-STACK', 'ARCH-GUARDS'];
  it('names a live plan the commit does not touch', () => {
    expect(planVerdict('NINE-DRAGON-STACK F3: rope', ['src/x.ts'], plans)).toEqual(['NINE-DRAGON-STACK']);
    expect(planVerdict('NINE-DRAGON-STACK F3: rope', ['docs/plans/NINE-DRAGON-STACK.md'], plans)).toEqual([]);
  });

  it('passes the Plan-State trailer, comment lines and partial names', () => {
    expect(planVerdict('ARCH-GUARDS: a note\n\nPlan-State: unchanged\n', [], plans)).toEqual([]);
    expect(planVerdict('fix\n# ARCH-GUARDS in a git comment line\n', [], plans)).toEqual([]);
    expect(planVerdict('ARCH-GUARDS-V2 lands', [], plans)).toEqual([]);
  });
});
