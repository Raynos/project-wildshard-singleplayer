import { expect, it, vi } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { InteractionRules } from '../src/game/quest/interactionRows';
import { SIGNAL_INTERACTIONS } from '../src/shards/sunscar-dunes/data/signalInteractions';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import { SignalDirector } from './fixtures/boss-owner/signalDirector';
import { bindDirectorActions } from '../src/game/plugin/director';
import rows from '../src/shards/sunscar-dunes/data/signalStages.json';

function signal(ports: { lit: () => boolean; summon: () => void }) {
  const host = bindDirectorActions(rows, { read: () => ({ lit: ports.lit() }),
    bindings: [{ action: { spawn: 'sunscar.matriarch' }, run: ports.summon }],
    initial: ports.lit() ? [{ lit: false }, { lit: true }] : [{ lit: false }] });
  return { ...host, light: host.advance };
}

it('summons at the accepted native fire edge after flags and dressing, never at denied or repeated interactions', () => {
  const flags = new Flags('signal.director', false), effects: string[] = [];
  flags.onChange((flag, on) => { if (on) effects.push(flag); });
  const rules = new InteractionRules(flags, SIGNAL_INTERACTIONS);
  const director = signal({ lit: () => flags.has(FLAG.lit), summon: () => { effects.push('summon'); } });
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
  const first = signal({ lit: () => lit, summon });
  lit = true; first.light(); expect(summon).toHaveBeenCalledOnce();
  const saved = first.snapshot();
  const restored = signal({ lit: () => lit, summon });
  expect(summon).toHaveBeenCalledOnce();
  restored.restore(saved); expect(restored.snapshot()).toBe(saved); restored.light();
  expect(summon).toHaveBeenCalledOnce();
  const before = restored.snapshot();
  expect(() => { restored.restore(JSON.stringify({ version: 1 })); }).toThrow();
  expect(restored.snapshot()).toBe(before);
});

it('preserves the frozen signal cursor and ordered effects on accepted, loaded and restored edges', () => {
  for (const loaded of [false, true]) {
    let lit = loaded;
    const a: string[] = [], b: string[] = [];
    const row = signal({ lit: () => lit, summon: () => { a.push('summon'); } });
    const old = new SignalDirector({ lit: () => lit, summon: () => { b.push('summon'); } });
    for (let tick = 0; tick < 300; tick++) {
      if (tick > 30) lit = true;
      row.light(); old.light();
      expect(row.snapshot()).toBe(old.snapshot()); expect(a).toEqual(b);
      if (tick % 31 === 0) { row.restore(old.snapshot()); old.restore(row.snapshot()); }
    }
  }
});

it('refuses missing or duplicate native bindings before initial observations or effects', () => {
  const run = vi.fn((): void => undefined);
  const read = vi.fn(() => ({ lit: true }));
  const binding = { action: { spawn: 'sunscar.matriarch' }, run };
  expect(() => bindDirectorActions(rows, { read, bindings: [], initial: [{ lit: false }] })).toThrow('Unbound');
  expect(() => bindDirectorActions(rows, { read, bindings: [binding, binding], initial: [{ lit: false }] })).toThrow('Duplicate');
  expect(run).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
});
