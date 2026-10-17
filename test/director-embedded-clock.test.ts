import { expect, test, vi } from 'vitest';
import { DirectorScriptStageLane, embeddedDirectorBytes, prepareEmbeddedDirector } from '../src/game/plugin/director';
import { Scope } from '../src/engine/app/scope';
import declaration from '../src/shards/pine-hollow/data/director.json';
import module from '../src/shards/pine-hollow/behaviour/director.json';
import rows from '../src/shards/pine-hollow/data/watchStages.json';
import bindings from '../src/shards/pine-hollow/data/directorBindings.json';
import { Flags } from '../src/engine/world/interact/flags';
import { pineDirectorClock } from './fixtures/director-pine/stageClock';

test.each([true, false])('Pine direct bindings preserve every AS/stage snapshot with a sky clock: %s', async hasClock => {
  const create = await prepareEmbeddedDirector(declaration, module, 357), scope = new Scope('pine-clock');
  const oldEvents: [string, number][] = [], events: [string, number][] = [];
  let seen = false, night = 0;
  const old = pineDirectorClock(create(), { seen: () => seen, night: () => night, hasClock: () => hasClock,
    publish: (key, value) => { oldEvents.push([key, value]); } }, () => !scope.disposed);
  const flags = new Flags('bound-watch', false);
  const lane = DirectorScriptStageLane.bind(rows, create(), bindings, new Map<string, unknown>([
    ['flags', flags], ['clock', { day: () => hasClock ? {} : null, night: () => night }],
    ['publication', { publish: (key: string, value: number) => { events.push([key, value]); } }],
  ]), scope);
  const equal = (): void => { expect(events).toEqual(oldEvents); expect(lane.snapshot()).toBe(old.save()); };
  try {
    equal(); old.night(); lane.request('night.request'); equal();
    old.dawn(); lane.request('dawn.request'); equal();
    old.dawn(); lane.request('dawn.request'); equal();
    for (const dt of [0.1, 0.9, 1, 0.49, 0.01, 0.5, 1, 1, 0.1, 0.9, 1, 1, 1, 1, 1, 1]) {
      old.tick(dt); lane.update(dt); equal();
      const saved = lane.snapshot(), count = events.length;
      old.load(saved); lane.restore(saved); equal(); expect(events).toHaveLength(count);
    }
    expect(events.some(([key]) => key === 'dawn.finish')).toBe(true);
    seen = true; flags.set('seen:dawn'); night = 1; old.night(); lane.request('night.request'); equal();
    old.dawn(); lane.request('dawn.request'); equal();
    const saved = lane.snapshot(); scope.dispose();
    old.night(); lane.request('night.request'); old.dawn(); lane.request('dawn.request');
    old.tick(1); lane.update(1); lane.changed(); equal(); expect(lane.snapshot()).toBe(saved);
  } finally { scope.dispose(); }
});

test('embedded admission refuses stale names and changed bytes and installs independent memory', async () => {
  expect(() => embeddedDirectorBytes(declaration, { ...module, module: '0'.repeat(64) })).toThrow('stale');
  const bytes = embeddedDirectorBytes(declaration, module); bytes[bytes.length - 1] = 0;
  const changed = { ...module, bytes: btoa(Array.from(bytes, byte => String.fromCodePoint(byte)).join('')) };
  await expect(prepareEmbeddedDirector(declaration, changed, 357)).rejects.toThrow('hash mismatch');
  const create = await prepareEmbeddedDirector(declaration, module, 357), first = create(), second = create();
  first.step(0, { 'night-request': 0, 'dawn-request': 0, seen: 0, 'has-clock': 1, night: 0 });
  expect(first.tick).toBe(0); expect(second.tick).toBe(-1);
});

test('literal bindings reject invalid row payloads before initialization and mismatching delivered payloads', async () => {
  const create = await prepareEmbeddedDirector(declaration, module, 357), script = create(), publish = vi.fn();
  const actions = new Map(rows.stages.flatMap(stage => stage.do ?? []).map(action => [action.emit, publish]));
  const invalid = structuredClone(rows), watch = invalid.stages.find(stage => stage.id === 'watching');
  if (watch?.do?.[0] === undefined) throw new Error('Missing watch action');
  watch.do[0].value = 5;
  const ports = { observe: () => ({ 'night-request': 0, 'dawn-request': 0, seen: 0, 'has-clock': 1, night: 0 }),
    emits: { source: 'matching' as const, value: 'literal' as const, actions } };
  expect(() => new DirectorScriptStageLane(invalid, script, ports)).toThrow('Unbound director emit action');
  expect(script.tick).toBe(-1); expect(publish).not.toHaveBeenCalled();
  vi.spyOn(script, 'step').mockReturnValue([{ director: script.data.id, tick: 0, key: 'night.start', type: 'number', value: 5 }]);
  expect(() => new DirectorScriptStageLane(rows, script, ports)).toThrow('Invalid director emit source');
  expect(publish).not.toHaveBeenCalled();
});
