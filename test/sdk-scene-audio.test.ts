import { Group, Scene } from 'three';
import { expect, it } from 'vitest';
import { AmbienceZone, Cue, Score } from '../src/sdk/audio';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { TEMPLATE_AUDIO } from '../src/shards/_template/data/audio';
import { PASTEL_AUDIO } from '../src/shards/pastel-plain/data/audio';

for (const [name, recipe] of [['Template 1', TEMPLATE_AUDIO], ['Pastel Plain', PASTEL_AUDIO]] as const) {
  it(`${name}: the real cue/ambience/score profile crosses persisted scene JSON with every emitted byte identical`, () => {
    const scene = new Scene(); scene.add(Score.fromData(recipe));
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- This proof must cross the inspectable JSON transport.
    const persisted = JSON.parse(JSON.stringify(readScene(scene))) as SceneDescription;
    expect(persisted.audio).toStrictEqual(recipe);
    expect(new TextEncoder().encode(encodeCanonicalJson(persisted.audio))).toStrictEqual(new TextEncoder().encode(encodeCanonicalJson(recipe)));
    expect(readScene(scene.clone()).audio).toStrictEqual(recipe);
    expect(Score.fromData(recipe).toAudioData()).toStrictEqual(recipe);
  });
}

it('moves a real zone centre and radii through a parent transform once, preserving mixer and cue order', () => {
  const scene = new Scene(), score = new Score({ ...TEMPLATE_AUDIO, cues: [], zones: {
    id: 'forest', smoothSeconds: 0.1, tickHz: 30, silentSeconds: 5, holdSeconds: 1, levels: { forest: 1 }, wet: {}, zones: [],
  } }), group = new Group(), zone = new AmbienceZone({ id: 'camp', x: 1, z: 2, inner: 3, outer: 5, fade: 2, gain: 0.8, source: 'forest' });
  group.position.set(10, 0, -4); group.scale.setScalar(2); group.add(zone); scene.add(score, new Cue('cue.first', 'sword.hit'), new Cue('cue.second', 'weapon.swap'), group);
  const audio = readScene(scene).audio;
  expect(audio?.cues.map(cue => cue.id)).toEqual(['cue.first', 'cue.second']);
  expect(audio?.zones?.zones).toEqual([{ id: 'camp', x: 12, z: 0, inner: 6, outer: 10, fade: 4, gain: 0.8, source: 'forest' }]);
  expect(readScene(scene.clone()).audio).toStrictEqual(audio);
});

it('refuses duplicate cues/profiles, missing mixers and tilted or elliptic regions, without AudioContext', () => {
  const scene = new Scene(); scene.add(new Cue('cue.hit', 'sword.hit'), new Cue('cue.hit', 'sword.hit')); expect(() => readScene(scene)).toThrow();
  const two = new Scene(); two.add(new Score(), new Score()); expect(() => readScene(two)).toThrow(/one audio/u);
  const zone = new AmbienceZone({ id: 'camp', x: 0, z: 0, inner: 1, outer: 2, gain: 1 }), regions = new Scene(); regions.add(zone);
  expect(() => readScene(regions)).toThrow(/mixer/u);
  zone.rotation.x = 0.1; expect(() => zone.toZoneData()).toThrow(/horizontal/u);
  zone.rotation.x = 0; zone.scale.x = 2; expect(() => zone.toZoneData()).toThrow(/circular/u);
});
