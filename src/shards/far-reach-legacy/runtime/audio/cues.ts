import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { CombatCues, CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import { sharedWeaponVoices } from '@wildshard/sdk/runtime/audio/weaponVoices';
import source from '../../shard.config';

/** Bind the existing kit recipes to declared cue ids, preserving optional pan/gain arguments. */
export function skyCueMap(voices: Pick<ReturnType<typeof sharedWeaponVoices>, 'swordSwing' | 'swordHeavy' | 'swordHit' | 'weaponSwap'>): CombatCueMap {
  const recipes = new Map<string, (opts: CombatCueOpts) => undefined>();
  recipes.set('kit.swordSwing', () => { voices.swordSwing(); });
  recipes.set('kit.swordHeavy', () => { voices.swordHeavy(); });
  recipes.set('kit.swordHit', (opts) => { voices.swordHit(opts.surface === 'wood' ? 'wood' : 'flesh', opts.pan, opts.gain); });
  recipes.set('kit.weaponSwap', () => { voices.weaponSwap(); });
  return createCueRouter(source.audio.routing, { voices: recipes });
}
export function installSkyCues(audio: Audio, cues: CombatCues, scope: Scope): void {
  cues.use(skyCueMap(sharedWeaponVoices(audio)), scope);
}
