import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { CombatCues } from '@wildshard/engine/combat/cues';
import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import { declaredWeaponVoices } from '@wildshard/game/plugin/audio';
import source from '../../shard.config';

/** Install authored aliases on the shared native kit voices; the scope removes the dispatcher on unload. */
export function installSkyCues(audio: Audio, cues: CombatCues, scope: Scope, routing = source.audio.routing): void {
  const voices = new Map([...declaredWeaponVoices(audio)].map(([id, voice]) => [id, (opts: Parameters<typeof voice>[0]): undefined => { voice(opts); }]));
  cues.use(createCueRouter(routing, { voices }), scope);
}
