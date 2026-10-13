import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { CombatCues, CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import { sharedWeaponVoices } from '@wildshard/game/plugin/audio';
import source from '../source';

/** Bind the existing kit recipes to declared cue ids, preserving optional pan/gain arguments. */
export function sunscarCueMap(voices: Pick<ReturnType<typeof sharedWeaponVoices>, 'swordSwing' | 'swordHeavy' | 'swordHit' | 'weaponSwap' | 'reload'>,
  routing = source.audio.routing): CombatCueMap {
  const recipes = new Map<string, (opts: CombatCueOpts) => undefined>();
  recipes.set('kit.swordSwing', () => { voices.swordSwing(); });
  recipes.set('kit.swordHeavy', () => { voices.swordHeavy(); });
  recipes.set('kit.swordHit', (opts) => { voices.swordHit('flesh', opts.pan, opts.gain); });
  recipes.set('kit.weaponSwap', () => { voices.weaponSwap(); });
  recipes.set('kit.reload', () => { voices.reload(); });
  return createCueRouter(routing, { voices: recipes });
}
export function installSunscarCues(audio: Audio, cues: CombatCues, scope: Scope, routing = source.audio.routing): void {
  cues.use(sunscarCueMap(sharedWeaponVoices(audio), routing), scope);
}
