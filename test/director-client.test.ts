// oxlint-disable-next-line import/no-nodejs-modules -- Native lifecycle tests read the immutable authored module.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { SystemSpec } from '../src/engine/app/systems';
import type { DebugRowSpec } from '../src/engine/level/context';
import { parseDirector, type DirectorEvent } from '../src/game/shardfile/director';
import * as runtimeVariant from '../src/game/shard/runtimeVariant';
import { directorVariant, installDeclaredDirector } from '../src/game/shardfile/directorClient';
import declaration from '../src/shards/driftwood-isle/data/director.json';

const data = parseDirector(declaration), bytes = readFileSync(`src/shards/driftwood-isle/assets/${data.module}`);
const row: Omit<DebugRowSpec, 'change'> = { id: 'fixture.director', group: 'tools', label: 'Director', choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true, note: 'Fixture', ask: 'E435', reviewBy: '2026-10-18' };
describe('SF24 director installation lifecycle', () => {
  it('requires the default-off reload variant and activates only a saved Debug choice', () => {
    expect(directorVariant({ debugRow: (value) => { expect(value.id).toBe('shardDirectors'); expect(value.label).toBe('Shard directors (data)'); } })).toBe(false);
    expect(directorVariant({ debugRow: () => { /* Saved choice is absent. */ } }, row)).toBe(false);
    expect(directorVariant({ debugRow: (value) => { value.change('on'); } }, row)).toBe(true);
    expect(() => directorVariant({ debugRow: () => { /* Validation runs before registration. */ } }, { ...row, initial: 'on' })).toThrow('default off');
  });
  it('keeps a saved declared selection inactive outside Developer', () => {
    const enabled = vi.spyOn(runtimeVariant, 'developerToolsEnabled').mockReturnValue(false);
    const context = { debugRow: (spec: DebugRowSpec) => { expect(spec.purpose).toBe('developer'); spec.change('on'); } };
    expect(directorVariant(context)).toBe(false);
    enabled.mockReturnValue(true); expect(directorVariant(context)).toBe(true);
    enabled.mockReturnValue(false); expect(directorVariant(context)).toBe(false);
  });
  it('shares one saved selection across creature and director consumers in the same context', () => {
    vi.spyOn(runtimeVariant, 'developerToolsEnabled').mockReturnValue(true);
    const registered: DebugRowSpec[] = [], context = { debugRow: (spec: DebugRowSpec) => { registered.push(spec); spec.change('on'); } };
    expect(directorVariant(context)).toBe(true); expect(directorVariant(context)).toBe(true); expect(registered).toHaveLength(1);
    registered[0]?.change('off'); expect(directorVariant(context)).toBe(false);
    expect(() => directorVariant(context, { ...row, id: 'shardDirectors' })).toThrow('Conflicting');
    expect(directorVariant({ debugRow: () => undefined })).toBe(false);
  });
  it('owns the fixed step and leaves no callback active after unload', async () => {
    const scope = new Scope('director.client'), systems: SystemSpec[] = [], events: DirectorEvent[] = [];
    let altar = 1;
    const lane = await installDeclaredDirector({ scope, system: (system) => { systems.push(system); } }, {
      data, bytes: () => Promise.resolve(bytes), seed: 357, systemId: 'fixture.director',
      observe: () => ({ altar, dead: 0, seen: 0, 'player-x': 20, 'player-z': 0, 'reward-x': 0, 'reward-z': 0 }),
      publish: (event) => { events.push(event); },
    });
    expect(events.map((event) => [event.tick, event.key])).toEqual([[0, 'captain.restore']]);
    expect(systems[0]?.phase).toBe('fixed.post');
    altar = 0; systems[0]?.run(1 / 60, 1 / 60); altar = 1; systems[0]?.run(1 / 60, 2 / 60);
    expect(events.map((event) => [event.tick, event.key])).toEqual([[0, 'captain.restore'], [2, 'captain.wake']]);
    const saved = lane.snapshot(); systems[0]?.run(1 / 60, 3 / 60); lane.restore(saved);
    expect(lane.tick).toBe(2); systems[0]?.run(1 / 60, 3 / 60); expect(lane.tick).toBe(3);
    lane.restore(saved); scope.dispose(); systems[0]?.run(1 / 60, 3 / 60);
    expect(lane.snapshot()).toBe(saved);
  });
  it('admits an external clock without registering a second fixed callback', async () => {
    const scope = new Scope('director.external'), systems: SystemSpec[] = [], events: DirectorEvent[] = [];
    try {
      const lane = await installDeclaredDirector({ scope, system: system => { systems.push(system); } }, {
        data, bytes: () => Promise.resolve(bytes), seed: 357, systemId: 'fixture.external', clock: 'external',
        observe: () => ({ altar: 0, dead: 0, seen: 0, 'player-x': 20, 'player-z': 0, 'reward-x': 0, 'reward-z': 0 }),
        publish: event => { events.push(event); },
      });
      expect(lane.tick).toBe(0); expect(systems).toEqual([]); expect(events).toEqual([]);
    } finally { scope.dispose(); }
  });
  it('rejects async admission after unload and rejects undeclared subscriptions before fetching', async () => {
    const scope = new Scope('director.cancel'); let published = 0, fetched = 0;
    const options = { data, bytes: () => { fetched++; scope.dispose(); return Promise.resolve(bytes); }, seed: 357, systemId: 'fixture.director', observe: () => ({}), publish: () => { published++; } };
    await expect(installDeclaredDirector({ scope, system: () => { published++; } }, options)).rejects.toThrow('scope left');
    expect(published).toBe(0);
    await expect(installDeclaredDirector({ scope, system: () => { published++; } }, { ...options, subscriptions: [{ key: 'undeclared', subscribe: () => () => { /* No listener was installed. */ } }] })).rejects.toThrow('Undeclared');
    expect(fetched).toBe(1);
  });
});
