// oxlint-disable-next-line import/no-nodejs-modules -- Native oracle hashes actual pre-conversion kit recipe arguments.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import type { CombatCueOpts } from '../../../src/engine/combat/cues';
import { sunscarCueMap } from '../../../src/shards/sunscar-dunes/audio/cues';
import { CUES } from '../../../src/shards/sunscar-dunes/data/cues';

// Captured from the original switch at 12310ead5.
it('preserves 270 kit dispatches, fallback and optional impact arguments', () => {
  const digest = createHash('sha256'); let dispatches = 0;
  const record = (name: string, ...args: readonly (string | number | undefined)[]): void => { digest.update(JSON.stringify(['voice', name, ...args])); };
  const voices = { swordSwing: () => { record('swordSwing'); }, swordHeavy: () => { record('swordHeavy'); }, reload: () => { record('reload'); }, weaponSwap: () => { record('weaponSwap'); },
    swordHit: (kind?: 'wood' | 'flesh' | 'ground', pan?: number, gain?: number) => { record('swordHit', kind, pan, gain); } };
  const cue = sunscarCueMap(voices);
  for (const surface of [undefined, 'wood', 'flesh', 'ground', 'metal']) for (const pan of [undefined, 0, -0.4]) for (const gain of [undefined, 0, 0.7]) {
    const opts: CombatCueOpts = {};
    if (surface !== undefined) opts.surface = surface; if (pan !== undefined) opts.pan = pan; if (gain !== undefined) opts.gain = gain;
    for (const id of [CUES.fire, CUES.heavy, CUES.impact, CUES.reload, 'cue.swap', 'cue.unknown'] as const) { digest.update(JSON.stringify([id, opts, cue(id, opts)])); dispatches++; }
  }
  expect(dispatches).toBe(270);
  expect(digest.digest('hex')).toBe('494b8b1f1ac21c95ef6a7a1396cd210849ebafac176fc365c1a9cc46f315f879');
});
