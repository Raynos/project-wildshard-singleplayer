// oxlint-disable-next-line import/no-nodejs-modules -- Native oracle hashes the old actual recipe/tap/argument and random-draw stream.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import type { CueOpts } from '../../../src/engine/audio/Cues';
import { tap } from '../../../src/engine/core/harnessTap';
import { ndCueMap } from '../../../src/shards/nine-dragon-stack/audio/cues';
import { ndPick } from '../../../src/shards/nine-dragon-stack/audio/files';
import { ndZones } from '../../../src/shards/nine-dragon-stack/audio/ambience';

// Captured from cues.ts at 12310ead5, before declared routing. No rebaseline.
it('preserves 9396 dispatches, aliases, taps, footfall cycle, fallbacks and chime random draws', () => {
  const digest = createHash('sha256'); let dispatches = 0;
  const previous = tap.sound; tap.sound = (...args) => { digest.update(JSON.stringify(['tap', ...args])); };
  const ids = ['step', 'cue.jian.swing', 'cue.sword.swing', 'melee.swing', 'cue.jian.heavy', 'cue.sword.heavy', 'melee.heavy', 'cue.jian.hit', 'cue.sword.hit', 'melee.hit', 'cue.grapple.fire', 'grapple.fire', 'cue.grapple.bite', 'grapple.bite', 'cue.grapple.reel', 'grapple.reel', 'cue.grapple.dock', 'grapple.dock', 'cue.grapple.zip', 'grapple.zip', 'chime.gust', 'hurt', 'pickup', 'unknown'];
  try {
    for (const loaded of [false, true]) for (const surface of [undefined, 'wood', 'planks', 'metal', 'flesh', 'ground']) for (const pan of [undefined, 0, -0.4])
      for (const gain of [undefined, 0, 0.7]) for (const sprinting of [undefined, false, true]) {
        let draws = 0; const opts: CueOpts = {};
        if (surface !== undefined) opts.surface = surface; if (pan !== undefined) opts.pan = pan; if (gain !== undefined) opts.gain = gain; if (sprinting !== undefined) opts.sprinting = sprinting;
        const map = ndCueMap({ play: (...args) => { digest.update(JSON.stringify(['play', ...args])); return loaded; } }, () => { draws++; return 0.25; });
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

it('preserves the original enclosed-region blend at 2337 listener positions', () => {
  const hash = createHash('sha256'); let positions = 0;
  for (let x = -48; x <= 92; x += 2.5) for (let z = -250; z <= 40; z += 7.25) { hash.update(JSON.stringify([x, z, ndZones({ x, z })])); positions++; }
  expect(positions).toBe(2337);
  expect(hash.digest('hex')).toBe('b13189726844b3ff14b20e625e5291ccc3785c61698190122793a5dc6aede32e');
});
