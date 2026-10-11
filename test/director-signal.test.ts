import { expect, it, vi } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { InteractionRules } from '../src/game/quest/interactionRows';
import { SIGNAL_INTERACTIONS } from '../src/shards/sunscar-dunes/quests/interactions';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import { SignalDirector } from '../src/shards/sunscar-dunes/runtime/signalDirector';

it('summons at the accepted native fire edge after flags and dressing, never at denied or repeated interactions', () => {
  const flags = new Flags('signal.director', false), effects: string[] = [];
  flags.onChange((flag, on) => { if (on) effects.push(flag); });
  const rules = new InteractionRules(flags, SIGNAL_INTERACTIONS);
  const director = new SignalDirector({ lit: () => flags.has(FLAG.lit), summon: () => { effects.push('summon'); } });
  const fire = (): void => { if (rules.run('fire', () => { effects.push('dressing'); }).ok) director.light(); };
  fire(); expect(effects).toEqual([]);
  rules.run('crank'); rules.run('well');
  for (const i of [0, 1, 2]) { rules.run(`pour.${i}`); rules.run(`light.${i}`); fire(); }
  expect(effects.slice(-3)).toEqual(['dressing', FLAG.lit, 'summon']);
  const before = [...effects]; fire(); director.light(); expect(effects).toEqual(before);
});

it('keeps the loaded light and full restore quiet, and refuses a foreign cursor before changing state', () => {
  let lit = false;
  const summon = vi.fn((): void => undefined);
  const first = new SignalDirector({ lit: () => lit, summon });
  lit = true; first.light(); expect(summon).toHaveBeenCalledOnce();
  const saved = first.snapshot();
  const restored = new SignalDirector({ lit: () => lit, summon });
  expect(summon).toHaveBeenCalledOnce();
  restored.restore(saved); expect(restored.snapshot()).toBe(saved); restored.light();
  expect(summon).toHaveBeenCalledOnce();
  const before = restored.snapshot();
  expect(() => { restored.restore(JSON.stringify({ version: 1 })); }).toThrow();
  expect(restored.snapshot()).toBe(before);
});
