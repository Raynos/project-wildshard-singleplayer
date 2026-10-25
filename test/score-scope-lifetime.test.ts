// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Audio } from '../src/engine/audio/Audio';
import { Music } from '../src/engine/audio/Music';
import { CatalogueScore } from '../src/engine/audio/SetScore';
import { parseAudioData } from '../src/format/audio';
import pine from '../src/shards/pine-hollow/data/audioSource.json';
import { realGc } from '@wildshard/engine/test/realGc';

function retiredScore(music: Music): { ref: WeakRef<Scope>; score: CatalogueScore } {
  const profile = parseAudioData(pine.audio).music;
  if (profile === undefined) throw new Error('Missing persistent score');
  const scope = new Scope('runtime.entered');
  const score = CatalogueScore.install(new Audio(), music, scope, profile);
  score.setScene('boss'); score.setBossPhase(3);
  const ref = new WeakRef(scope); scope.dispose();
  return { ref, score };
}

test('a persistent score releases its retired entered Scope', async () => {
  await realGc('test/score-scope-lifetime.test.ts', 'a persistent score releases its retired entered Scope', async collect => {
    const music = new Music(new Audio()), { ref, score } = retiredScore(music);
    await collect(ref);
    expect(score.want(undefined)).toBeUndefined();
    expect(score.sceneName).toBe('boss'); expect(score.phase).toBe(3);
    const profile = parseAudioData(pine.audio).music;
    if (profile === undefined) throw new Error('Missing persistent score');
    expect(CatalogueScore.get(music, profile)).toBe(score);
    const next = new Scope('runtime.entered.next');
    try {
      expect(CatalogueScore.install(new Audio(), music, next, profile)).toBe(score);
      expect(score.sceneName).toBe('boss'); expect(score.phase).toBe(3);
    } finally { next.dispose(); }
  });
});

test('an older score attachment cannot retire its newer entered owner', () => {
  const music = new Music(new Audio()), profile = parseAudioData(pine.audio).music;
  if (profile === undefined) throw new Error('Missing persistent score');
  const first = new Scope('first'), next = new Scope('next');
  const score = CatalogueScore.install(new Audio(), music, first, profile);
  CatalogueScore.install(new Audio(), music, next, profile);
  first.dispose();
  try {
    expect(() => score.bindProfile({ ...profile, minFade: (profile.minFade ?? 0) + 1 })).toThrow('entered');
  } finally { next.dispose(); }
});
