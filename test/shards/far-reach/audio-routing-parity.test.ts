// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Native oracle hashes actual pre-conversion kit recipe arguments.
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { CombatCues, type CombatCueOpts } from '../../../src/engine/combat/cues';
import { skyCueMap } from '../../../src/shards/far-reach-legacy/runtime/audio/cues';
import { installSkyCues } from '../../../src/shards/far-reach/runtime/audio/cues';
import { sharedWeaponVoices } from '../../../src/game/plugin/audio';
import { Audio } from '../../../src/engine/audio/Audio';
import { Scope } from '../../../src/engine/app/scope';
import { tap } from '../../../src/engine/core/harnessTap';
import { CUES } from '../../../src/shards/far-reach/data/cues';

// Captured from the original switch at 12310ead5.
it('preserves 270 kit dispatches, fallback and optional impact arguments', () => {
  const digest = createHash('sha256'); let dispatches = 0;
  const record = (name: string, ...args: readonly (string | number | undefined)[]): void => { digest.update(JSON.stringify(['voice', name, ...args])); };
  const voices = { swordSwing: () => { record('swordSwing'); }, swordHeavy: () => { record('swordHeavy'); }, reload: () => { record('reload'); }, weaponSwap: () => { record('weaponSwap'); },
    swordHit: (kind?: 'wood' | 'flesh' | 'ground', pan?: number, gain?: number) => { record('swordHit', kind, pan, gain); } };
  const cue = skyCueMap(voices);
  for (const surface of [undefined, 'wood', 'flesh', 'ground', 'metal']) for (const pan of [undefined, 0, -0.4]) for (const gain of [undefined, 0, 0.7]) {
    const opts: CombatCueOpts = {};
    if (surface !== undefined) opts.surface = surface; if (pan !== undefined) opts.pan = pan; if (gain !== undefined) opts.gain = gain;
    for (const id of [CUES.fire, CUES.impact, CUES.heavy, CUES.reload, 'cue.swap', 'cue.unknown'] as const) { digest.update(JSON.stringify([id, opts, cue(id, opts)])); dispatches++; }
  }
  expect(dispatches).toBe(270);
  expect(digest.digest('hex')).toBe('53df8cacd44abb3b9f9ddba7912367b4adfddeb3d408241b16d3821bf8d5358a');
});


it('the actual shared kit recipes preserve frozen surface/optional arguments, taps and scope removal', () => {
  const beforeAudio = new Audio(), afterAudio = new Audio(), cues = new CombatCues(), scope = new Scope('sky-audio-row-parity');
  const before: unknown[] = [], after: unknown[] = [];
  vi.spyOn(beforeAudio, 'cue').mockImplementation((id, opts) => { before.push(['cue', id, opts]); return true; });
  vi.spyOn(afterAudio, 'cue').mockImplementation((id, opts) => { after.push(['cue', id, opts]); return true; });
  vi.spyOn(beforeAudio, 'weaponSwap').mockImplementation(() => { before.push(['swap']); });
  vi.spyOn(afterAudio, 'weaponSwap').mockImplementation(() => { after.push(['swap']); });
  const frozen = skyCueMap(sharedWeaponVoices(beforeAudio));
  const previous = tap.sound;
  try {
    installSkyCues(afterAudio, cues, scope);
    for (const surface of [undefined, 'wood', 'flesh', 'ground', 'metal']) for (const pan of [undefined, 0, -0.4]) for (const gain of [undefined, 0, 0.7]) {
      const opts: CombatCueOpts = {};
      if (surface !== undefined) opts.surface = surface; if (pan !== undefined) opts.pan = pan; if (gain !== undefined) opts.gain = gain;
      for (const id of [CUES.fire, CUES.impact, CUES.heavy, CUES.reload, 'cue.swap', 'cue.unknown'] as const) {
        before.length = 0; after.length = 0;
        tap.sound = soundId => { before.push(['tap', soundId]); };
        const expected = frozen(id, opts);
        tap.sound = soundId => { after.push(['tap', soundId]); };
        expect(cues.cue(id, opts)).toBe(expected); expect(after).toEqual(before);
      }
    }
    scope.dispose(); after.length = 0;
    expect(cues.cue(CUES.fire)).toBe(false); expect(after).toEqual([]);
  } finally { tap.sound = previous; scope.dispose(); vi.restoreAllMocks(); beforeAudio.dispose(); afterAudio.dispose(); }
});
