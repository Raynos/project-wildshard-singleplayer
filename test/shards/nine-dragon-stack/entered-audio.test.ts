// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import type { SystemSpec } from '../../../src/engine/app/systems';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import { tap } from '../../../src/engine/core/harnessTap';
import { parseAudioData, type AudioData } from '@wildshard/format/audio';
import type { ShardContext } from '../../../src/game/plugin/context';
import { installAudio } from '../../../src/shards/nine-dragon-stack/runtime/audio/ambience';
import source from '../../../src/shards/nine-dragon-stack/shard.config';

function fixturePort<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get(target, key) {
    if (!(key in target)) throw new Error(`Unused fixture port ${String(key)}`);
    return Reflect.get(target, key);
  } }) as T;
}

async function enteredTrace(rows?: AudioData): Promise<unknown[]> {
  const app = new App(), scope = app.engineScope.child('nine-audio');
  const audio = withOwner(scope, () => new Audio()), music = withOwner(scope, () => new Music(audio));
  audio.music = music; app.audio = audio; audio.worldMuted = false;
  const trace: unknown[] = [], systems: SystemSpec[] = [];
  const rng = vi.spyOn(app.rng.stream('cosmetic'), 'next').mockImplementation(() => { trace.push(['rng']); return 0.25; });
  const ready = vi.spyOn(audio, 'ready', 'get').mockReturnValue(true);
  const refresh = vi.spyOn(music, 'refreshScore').mockImplementation(() => { trace.push(['refresh']); });
  const before = tap.sound; tap.sound = (...args) => { trace.push(['tap', ...args]); };
  const context = fixturePort<ShardContext>({ app, scope,
    game: fixturePort<ShardContext['game']>(rows === undefined ? {} : { declaredAudio: rows }),
    system: (spec) => { systems.push(spec); }, debug: fixturePort<ShardContext['debug']>({ expose: () => undefined }) });
  try {
    await installAudio(context);
    expect(music.scoreId).toBe('score.nd'); expect(audio.bedIds).toEqual(['bed.nd.market', 'bed.nd.well']);
    const update = systems.find(system => system.id === 'shard.nd.audio');
    if (update === undefined) throw new Error('Missing native Nine audio tick');
    for (let tick = 0; tick < 1200; tick++) {
      audio.listenerPosition = tick % 100 < 50 ? new Vector3(-10, 1, 0) : new Vector3(10, 1, 0);
      update.run(0.25, tick * 0.25);
    }
    expect(trace.filter(row => Array.isArray(row) && row[0] === 'rng').length).toBeGreaterThan(1);
    scope.dispose(); expect(music.scoreId).toBeUndefined(); expect(audio.bedIds).toBeUndefined();
    return trace;
  } finally { tap.sound = before; scope.dispose(); ready.mockRestore(); rng.mockRestore(); refresh.mockRestore(); audio.dispose(); app.engineScope.dispose(); }
}

it('keeps actual native bed cadence, taps, chime draws and scoped retirement through emitted rows', async () => {
  const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
  expect(await enteredTrace(rows)).toEqual(await enteredTrace());
});
