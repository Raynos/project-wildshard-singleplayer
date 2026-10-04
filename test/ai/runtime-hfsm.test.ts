import { describe, expect, it } from 'vitest';
import { Hfsm } from '#engine-internal/ai/hfsm';

describe('hierarchical brain transitions', () => {
  it('exits leaf first, preserves shared parents, and enters the next leaf', () => {
    const log: string[] = [], state = (name: string, parent?: 'fight') => ({ ...parent === undefined ? {} : { parent },
      enter: (out: string[]): void => { out.push(`enter:${name}`); }, exit: (out: string[]): void => { out.push(`exit:${name}`); } });
    const fsm = new Hfsm<'idle' | 'fight' | 'windup' | 'recover', string[]>({ idle: state('idle'), fight: state('fight'), windup: state('windup', 'fight'), recover: state('recover', 'fight') }, 'idle', log);
    fsm.transition('windup'); expect(fsm.path).toEqual(['fight', 'windup']); expect(fsm.in('fight')).toBe(true);
    fsm.transition('recover'); fsm.transition('idle');
    expect(log).toEqual(['enter:idle', 'exit:idle', 'enter:fight', 'enter:windup', 'exit:windup', 'enter:recover', 'exit:recover', 'exit:fight', 'enter:idle']);
  });
  it('does not tick a stale leaf after a parent transitions, and rejects parent cycles', () => {
    const log: string[] = [];
    const fsm = new Hfsm<'idle' | 'fight' | 'active', string[]>({ idle: {}, fight: { tick: () => { fsm.transition('idle'); } },
      active: { parent: 'fight', tick: (out): void => { out.push('stale'); } } }, 'active', log);
    fsm.tick(0.1); expect(log).toEqual([]); expect(fsm.state).toBe('idle');
    expect(() => new Hfsm({ a: { parent: 'b' }, b: { parent: 'a' } }, 'a', undefined)).toThrow('cycle');
  });
});
