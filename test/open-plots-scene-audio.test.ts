// @vitest-environment happy-dom
import { installAssetFixture } from './fixtures/bootSetup';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Audio } from '../src/engine/audio/Audio';
import { Music } from '../src/engine/audio/Music';
import { Scope } from '../src/engine/app/scope';
import { SetScore, type ScoreSource } from '../src/engine/audio/SetScore';
import type { LevelAudioBank } from '../src/engine/audio/levelAudio';
import type { Player } from '../src/engine/player/Player';
import { legacyDouble } from '../src/engine/test/FakeGame';
import { AudioSceneDirector } from '../src/game/audio/sceneDirector';
import { plotAudioData } from '../src/shards/open-plots/generators/audio';
import anchors from '../src/shards/open-plots/data/audioAnchors.json' with { type: 'json' };

await installAssetFixture();

class Pcm implements AudioBuffer {
  readonly sampleRate = 48000;
  readonly length = 48000;
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly samples = new Float32Array(this.length);
  getChannelData(): Float32Array<ArrayBuffer> { return this.samples; }
  copyFromChannel(destination: Float32Array, _channel: number, offset = 0): void { destination.set(this.samples.subarray(offset, offset + destination.length)); }
  copyToChannel(source: Float32Array, _channel: number, offset = 0): void { this.samples.set(source, offset); }
}

test('the native scene waits for all six own cue loops, then releases its score and bank listeners', () => {
  const data = plotAudioData('lantern-bayou', anchors['lantern-bayou'], { dir: '/assets/music/lantern-bayou/', manifestKey: 'lantern-bayou' });
  const scope = new Scope('plot.audio.control'), audio = new Audio(), music = new Music(audio);
  let source: ScoreSource | undefined;
  const refresh = vi.spyOn(music, 'refreshScore').mockImplementation(() => { /* No device is opened in this bank-lifetime control. */ });
  vi.spyOn(music, 'setScore').mockImplementation((_id, score) => { source = score; return () => { source = undefined; }; });
  const scene = new AudioSceneDirector(data, legacyDouble<Player>({ position: new Vector3(), yaw: 0 }));
  const bank: LevelAudioBank = { title: undefined, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } };
  try {
    scene.bind(audio, music, undefined, scope);
    if (!(source instanceof SetScore)) throw new Error('Missing native own score');
    expect(source.pending).toBe(true);
    audio.useLevelBank(bank); expect(source.pending).toBe(true);
    const ids = data.samples?.catalogue?.loopOrder; if (ids === undefined) throw new Error('Missing own loop inventory');
    const buffer = new Pcm();
    for (const id of ids.slice(0, -1)) bank.cues.loops.set(id, { buffer, loopStart: 0, loopEnd: 1, gain: 1 });
    audio.useLevelBank(bank); expect(source.pending).toBe(true);
    const final = ids.at(-1); if (final === undefined) throw new Error('Missing final loop');
    bank.cues.loops.set(final, { buffer, loopStart: 0, loopEnd: 1, gain: 1 });
    audio.useLevelBank(bank); expect(source.pending).toBe(false);
    const dispose = vi.spyOn(source, 'dispose');
    scope.dispose(); expect(source).toBeUndefined(); expect(audio.bedId).toBe('');
    expect(dispose).toHaveBeenCalledOnce();
    refresh.mockClear(); audio.useLevelBank(bank); expect(refresh).not.toHaveBeenCalled();
  } finally { scope.dispose(); }
});
