import { expect, it, vi } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { bindDirectorActions } from '../src/game/plugin/director';
import { bindSkyQuestStage } from '../src/shards/far-reach/runtime/quest';
import { SKY_QUEST_STAGES, SKY_QUEST_STAGE_INITIAL } from '../src/shards/far-reach/data/questStages';
import { FLAGS, vaneFlag } from '../src/shards/far-reach/quest/flags';
import { VANES } from '../src/shards/far-reach/data/layout';
import signal from '../src/shards/sunscar-dunes/data/signalStages.json';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';

it('keeps roost, vanes and raised effects in the same tick, including resets and silent restore', () => {
  const old = new Flags('sky.old', false), flags = new Flags('sky.rows', false);
  const before: string[] = [], after: string[] = [];
  old.onChange((key, on) => { before.push(`${key}:${on}`); });
  flags.onChange((key, on) => { after.push(`${key}:${on}`); });
  let dead = false, up = false;
  let roost = bindSkyQuestStage('roost', flags, () => dead);
  let vanes = bindSkyQuestStage('vanes', flags);
  let raised = bindSkyQuestStage('raised', flags, () => up);
  for (let tick = 0; tick < 512; tick++) {
    if (tick % 11 === 0) for (const owner of [old, flags]) owner.reset();
    dead = tick % 3 !== 0; up = tick % 5 !== 0;
    if (tick % 2 === 0) for (const owner of [old, flags]) owner.set(FLAGS.notes);
    for (const [index, vane] of VANES.entries()) if (tick % (index + 2) === 0) for (const owner of [old, flags]) owner.set(vaneFlag(vane.id));
    if (old.has(FLAGS.notes) && !old.has(FLAGS.roost) && dead) old.set(FLAGS.roost);
    if (!old.has(FLAGS.vanes) && VANES.every(vane => old.has(vaneFlag(vane.id)))) old.set(FLAGS.vanes);
    if (!old.has(FLAGS.raised) && up) old.set(FLAGS.raised);
    roost.advance(); vanes.advance(); raised.advance();
    expect(flags.all).toStrictEqual(old.all); expect(after).toStrictEqual(before);
    if (tick % 17 === 0) {
      const saved = flags.all, effects = [...after];
      flags.restore(saved);
      roost = bindSkyQuestStage('roost', flags, () => dead);
      vanes = bindSkyQuestStage('vanes', flags);
      raised = bindSkyQuestStage('raised', flags, () => up);
      expect(after).toStrictEqual(effects);
    }
  }
});

it('keeps the Signal owner cursor and spawn effects exact with real flag observations', () => {
  for (const loaded of [false, true]) {
    const flags = new Flags('signal.rows', false); flags.set(FLAG.lit, loaded);
    const a = vi.fn((): void => undefined), b = vi.fn((): void => undefined), initial = loaded ? [{ lit: false }, { lit: true }] : [{ lit: false }];
    const old = bindDirectorActions(signal, { read: () => ({ lit: flags.has(FLAG.lit) }), bindings: [{ action: { spawn: 'sunscar.matriarch' }, run: a }], initial });
    const rows = bindDirectorActions(signal, { flags, bindings: [{ action: { spawn: 'sunscar.matriarch' }, run: b }], initial });
    for (let tick = 0; tick < 300; tick++) {
      if (tick === 20) flags.set(FLAG.lit);
      rows.advance(); old.advance();
      expect(rows.snapshot()).toBe(old.snapshot()); expect(a.mock.calls).toStrictEqual(b.mock.calls);
      if (tick % 29 === 0) { rows.restore(old.snapshot()); old.restore(rows.snapshot()); }
    }
  }
});

it('refuses missing observation/action owners before native effects, and keeps explicit bindings authoritative', () => {
  const flags = new Flags('sky.refusal', false), effect = vi.fn((): void => undefined), read = vi.fn(() => ({ done: false, up: true }));
  expect(() => bindDirectorActions(SKY_QUEST_STAGES.raised, { flags, bindings: [], initial: SKY_QUEST_STAGE_INITIAL.raised })).toThrow('Unbound native director observation');
  expect(() => bindDirectorActions(SKY_QUEST_STAGES.vanes, { bindings: [], initial: SKY_QUEST_STAGE_INITIAL.vanes })).toThrow('Unbound native director observation');
  expect(() => bindDirectorActions(signal, { flags, bindings: [], initial: [{ lit: false }] })).toThrow('Unbound native director action');
  expect(flags.all).toStrictEqual([]);
  const explicit = bindDirectorActions(SKY_QUEST_STAGES.raised, { flags, read, bindings: [{ action: { flag: { key: FLAGS.raised, value: true } }, run: effect }], initial: SKY_QUEST_STAGE_INITIAL.raised });
  explicit.advance(); expect(effect).toHaveBeenCalledOnce(); expect(read).toHaveBeenCalledOnce();
  expect(flags.has(FLAGS.raised)).toBe(false);
});

it('admits all three stage declarations and keeps their JSON exact', () => {
  expect(VANES).toHaveLength(3);
  for (const row of Object.values(SKY_QUEST_STAGES)) {
    expect(row.version).toBe(2); expect(row.script).toBe(null);
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON is the admitted declaration transport.
    expect(JSON.parse(JSON.stringify(row))).toStrictEqual(row);
  }
});
