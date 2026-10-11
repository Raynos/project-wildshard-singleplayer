// oxlint-disable-next-line import/no-nodejs-modules -- Native oracle hashes the old actual recipe/tap/argument and random-draw stream.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import type { CueOpts } from '../../../src/engine/audio/Cues';
import { tap } from '../../../src/engine/core/harnessTap';
import { ndCueMap } from '../../../src/shards/nine-dragon-stack/runtime/audio/cues';
import { ndPick, ndScore } from '../../../src/shards/nine-dragon-stack/runtime/audio/files';
import { ndZones, prepareNdZones } from '../../../src/shards/nine-dragon-stack/runtime/audio/ambience';
import { parseAudioData } from '@wildshard/format/audio';
import { requireAudioProfile } from '../../../src/engine/audio/audioProfiles';
import source from '../../../src/shards/nine-dragon-stack/shard.config';

// Captured from cues.ts at 12310ead5, before declared routing. No rebaseline.
it.each(['legacy', 'emitted'] as const)('preserves 9396 frozen dispatches and random draws through %s rows', (arm) => {
  const wire = JSON.stringify(source.audio), routing = arm === 'emitted' ? parseAudioData(JSON.parse(wire)).routing : source.audio.routing;
  const digest = createHash('sha256'); let dispatches = 0;
  const previous = tap.sound; tap.sound = (...args) => { digest.update(JSON.stringify(['tap', ...args])); };
  const ids = ['step', 'cue.jian.swing', 'cue.sword.swing', 'melee.swing', 'cue.jian.heavy', 'cue.sword.heavy', 'melee.heavy', 'cue.jian.hit', 'cue.sword.hit', 'melee.hit', 'cue.grapple.fire', 'grapple.fire', 'cue.grapple.bite', 'grapple.bite', 'cue.grapple.reel', 'grapple.reel', 'cue.grapple.dock', 'grapple.dock', 'cue.grapple.zip', 'grapple.zip', 'chime.gust', 'hurt', 'pickup', 'unknown'];
  try {
    for (const loaded of [false, true]) for (const surface of [undefined, 'wood', 'planks', 'metal', 'flesh', 'ground']) for (const pan of [undefined, 0, -0.4])
      for (const gain of [undefined, 0, 0.7]) for (const sprinting of [undefined, false, true]) {
        let draws = 0; const opts: CueOpts = {};
        if (surface !== undefined) opts.surface = surface; if (pan !== undefined) opts.pan = pan; if (gain !== undefined) opts.gain = gain; if (sprinting !== undefined) opts.sprinting = sprinting;
        const map = ndCueMap({ play: (...args) => { digest.update(JSON.stringify(['play', ...args])); return loaded; } }, () => { draws++; return 0.25; }, routing);
        for (const id of [...ids, 'step', 'step', 'step', 'step', 'step']) { digest.update(JSON.stringify([id, opts, map(id, opts), draws])); dispatches++; }
      }
  } finally { tap.sound = previous; }
  expect(dispatches).toBe(9396);
  expect(digest.digest('hex')).toBe('b25550da57a9dd9cecda6e2ab9afce0ffb26039ce741fdf06e49c33bf55f0d7a');
});
it('retains combat priority, the strict Well threshold and the repeated market fallback', () => {
  for (const well of [0, 0.5, 0.50001, 1]) for (const mode of ['calm', 'alert', 'combat'] as const) {
    expect(ndPick({ well }, { mode, intensity: 0, underwater: false })).toEqual([mode === 'combat' ? 'nd-fight' : well > 0.5 ? 'nd-well' : 'nd-market', 'nd-market']);
  }
});

it.each(['legacy', 'emitted'] as const)('preserves 2337 frozen region blends through %s rows', (arm) => {
  const wire = JSON.stringify(source.audio), zones = arm === 'emitted' ? prepareNdZones(requireAudioProfile(parseAudioData(JSON.parse(wire)).zones, 'ambience.nd')) : ndZones;
  const hash = createHash('sha256'); let positions = 0;
  for (let x = -48; x <= 92; x += 2.5) for (let z = -250; z <= 40; z += 7.25) { hash.update(JSON.stringify([x, z, zones({ x, z })])); positions++; }
  expect(positions).toBe(2337);
  expect(hash.digest('hex')).toBe('b13189726844b3ff14b20e625e5291ccc3785c61698190122793a5dc6aede32e');
});

it('uses emitted cue aliases and score/zone data rather than imported declarations', async () => {
  const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
  let draws = 0; const played: unknown[] = [];
  const routes = parseAudioData({ ...rows, routing: [{ id: 'cue.emitted', bus: 'audio', actions: [{ voice: 'nd.chime.gust' }] }] }).routing;
  const cue = ndCueMap({ play: (...args) => { played.push(args); return true; } }, () => { draws++; return 0.25; }, routes);
  expect(cue('chime.gust', {})).toBe(false); expect(draws).toBe(0);
  expect(cue('cue.emitted', {})).toBe(true); expect(draws).toBe(1);
  expect(played).toEqual([['chime.gust', { pan: -0.15 }]]);
  const profile = requireAudioProfile(rows.music, 'score.nd');
  for (const well of [0, 0.5, 0.50001, 1]) for (const mode of ['calm', 'alert', 'combat'] as const) {
    const state = { mode, intensity: 0, underwater: false };
    expect(ndPick({ well }, state, profile)).toEqual(ndPick({ well }, state));
  }
  const score = await ndScore(() => undefined, { ...profile, minFade: 4, synthLead: 'marimba' });
  expect(score.minFade).toBe(4); expect(score.synthLead).toBe('marimba'); expect(score.pending).toBe(true); score.dispose();
  const zoneProfile = requireAudioProfile(rows.zones, 'ambience.nd');
  const zones = prepareNdZones({ ...zoneProfile, blendMetres: 12 });
  const well = 0.5 - 1 / 12;
  expect(zones({ x: 1, z: 0 })).toEqual({ market: 1 - well, well });
});
