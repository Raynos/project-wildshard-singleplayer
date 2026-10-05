// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { shardContext } from '../../../src/game/shard/context';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installEnteredPineVoices } from '../../../src/shards/pine-hollow/runtime/audio/entered';
import { FOREST_AUDIO } from '../../../src/shards/pine-hollow/runtime/audio/profile';
import { ForestVoices } from '../../../src/shards/pine-hollow/runtime/audio/synth';
import { installEnteredPineScore, pineScore } from '../../../src/shards/pine-hollow/runtime/audio/score';

function fixture() {
  const app = new App(), scope = app.engineScope.child('pine.audio');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const debugRow = vi.fn(() => () => undefined);
  const installation = createLevelInstallation(app, scope, { debugRow }, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const audio = withOwner(scope, () => new Audio({ bed: 'road' }));
  return { app, scope, context, audio, debugRow };
}

it('recreates Pine voices on two home entries and retires them before returning to the borrowed road bed', () => {
  const f = fixture(), hooks = new RetainedRuntimeHooks(f.context);
  const stop = vi.spyOn(ForestVoices.prototype, 'stop');
  try {
    const voices = installEnteredPineVoices(hooks.context, f.audio), first = voices();
    expect(first).toBeInstanceOf(ForestVoices); expect(f.audio.bedId).toBe(FOREST_AUDIO.bed);
    hooks.deactivate(); expect(voices()).toBeNull(); expect(f.audio.bedId).toBe('road');
    expect(stop.mock.instances).toContain(first);
    hooks.activate(); const second = voices();
    expect(second).toBeInstanceOf(ForestVoices); expect(second).not.toBe(first); expect(f.audio.bedId).toBe(FOREST_AUDIO.bed);
    hooks.deactivate(); expect(voices()).toBeNull(); expect(f.audio.bedId).toBe('road');
    expect(stop.mock.instances).toContain(second);
  } finally { f.app.engineScope.dispose(); f.audio.dispose(); }
  expect(f.scope.census).toMatchObject({ timers: 0, listeners: 0, disposers: 0 });
});

it('keeps ordinary Pine voices in the original kit scope without changing its ambient selection', () => {
  const f = fixture(), stop = vi.spyOn(ForestVoices.prototype, 'stop');
  try {
    const voices = installEnteredPineVoices(f.context, f.audio), installed = voices();
    expect(installed).toBeInstanceOf(ForestVoices); expect(f.audio.bedId).toBe('road');
    f.scope.dispose(); expect(stop.mock.instances).toContain(installed); expect(f.audio.bedId).toBe('road');
  } finally { f.app.engineScope.dispose(); f.audio.dispose(); }
});

it('unpublishes the actual Pine score on leave and resumes the same boss scene and phase on the next entry', () => {
  const f = fixture(), hooks = new RetainedRuntimeHooks(f.context);
  const music = withOwner(f.scope, () => new Music(f.audio));
  try {
    installEnteredPineScore(hooks.context, f.audio, music, hooks.context.debugRow);
    const score = pineScore(music);
    score.setPineScene('boss'); score.setBossPhase(3);
    expect(music.scoreId).toBe('score.pine');
    hooks.deactivate(); expect(music.scoreId).toBeUndefined(); expect(score.pending).toBe(false);
    hooks.activate(); expect(music.scoreId).toBe('score.pine'); expect(pineScore(music)).toBe(score);
    expect(score.sceneName).toBe('boss'); expect(score.phase).toBe(3);
    expect(f.debugRow).toHaveBeenCalledOnce();
    hooks.deactivate(); expect(music.scoreId).toBeUndefined();
  } finally { f.app.engineScope.dispose(); f.audio.dispose(); }
  expect(f.scope.census).toMatchObject({ timers: 0, listeners: 0, disposers: 0 });
});
