// The ask rules (E423, docs/process/ASKS.md): scripts/asks.mjs. No Plan-State or Handoff rules since the 2026-10-09 audit.
import { describe, expect, it } from 'vitest';
import { checkAsk, parseAsk } from '../scripts/asks.mjs';

const ask = (status: string, extra = '') => `# E9\n\n**Status:** ${status}\n**Ask:** do the thing\n${extra}`;
const known = (path: string) => path === 'docs/tasks/asks/E5.md' || path === 'docs/plans/NINE-DRAGON-STACK.md';

describe('parseAsk', () => {
  it('reads the state, date and fold target', () => {
    const a = parseAsk(ask('folded into E5 (2026-10-03, E423)'));
    expect(a).toMatchObject({ state: 'folded into', closed: true, target: 'E5', date: '2026-10-03' });
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

  it('no longer polices Handoff sections (no per-lane handoffs, Jake 2026-10-09)', () => {
    expect(checkAsk('E9', ask('open (2026-10-03)', '## Handoff (a)\n## Handoff (a)\n'), known)).toEqual([]);
    expect(checkAsk('E9', ask('done (2026-10-03)', '## Handoff (a)\n'), known)).toEqual([]);
  });
});
