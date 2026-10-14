import { runtimeAudio, audioObserverSystems } from '@wildshard/game/plugin/audio';
import type { AudioZones } from '@wildshard/format/audioProfiles';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeObserver, installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { pineScore, pineScorePick } from './score';
import { audioLog } from '@wildshard/engine/audio/audioLog';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Game } from '@wildshard/engine/core/Game';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { ForestAmbience, ZoneSpot } from './ambience';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';

/**
 * Pine Hollow's sound, hooked to its gameplay (PINE-HOLLOW-REMASTER A-rows, the audio-wiring lane). The sound lane made
 * the music slots, the zoned beds, the one-shots and the barks; the fights, the quest and the loadout already call the
 * one-shots / barks / the King's music themselves (antlerKing.ts, quest/index.ts, loadout.ts). What is left lives here:
 *
 *   the clock        PineDayNight's `night` → the ambience's night beds (owls, crickets, the thralls' fog) and the music's
 *                    scene: calm-night past dusk, theme 1 by day (hysteresis 0.55 / 0.35; the King's fight owns the scene
 *                    while it runs; Debug ▸ Audio ▸ Pine Hollow score pins it)
 *   the elites       an engaged named elite keeps the score in combat (theme / night's tension stem up) while it lasts
 *   the zones        the layout's creek (along its bed + the ridge stream), the waterfall, the mill wheel (only while it turns),
 *                    ridge wind (the crest + the lookout, open sky), the old-growth hush, the bear cave's mouth
 *   one-shots        a deer's alarm snort when one goes alert near you; the cabins' and the hamlet's doors (open / close)
 *
 * main.ts calls `installPineAudio` once on Pine Hollow, after the ambience, the fights and the quest. Every trigger lands in
 * `window.__audioLog` (src/engine/audio/audioLog.ts); `window.__pineAudio` has the spots.
 */
export interface PineAudioHost {
  game: Game;
  context?: ShardContext;
  audio: Audio;
  sky: Sky;
  music: Music;
  ambience: ForestAmbience;
  animals: AnimalManager;
  /** the cabins + the hamlet (their doors, the mill wheel's speed); null = none built */
  cabins: { interactables: Interactable[]; wheelSpeed: number; onDoor: (fn: (door: Interactable, opening: boolean) => void) => () => void } | null;
  /** a named elite is engaged (PineCombat.eliteEngaged) */
  eliteEngaged: () => boolean;
  params: URLSearchParams;
}


/** The shardfile's exact baked zone rows; only a live mill-wheel query remains a trusted runtime port. */
export function pineZoneSpots(wheel: () => number, profile: AudioZones = requireAudioProfile(source.audio.zones, 'ambience.pine')): ZoneSpot[] {
  return profile.zones.map((row) => {
    const zone = row.source === 'mill.wheel' ? 'mill' : row.source;
    if (zone !== 'creek' && zone !== 'waterfall' && zone !== 'mill' && zone !== 'ridge' && zone !== 'oldgrowth' && zone !== 'cave') throw new Error(`Unknown forest audio zone: ${row.id}`);
    const spot: ZoneSpot = { zone, x: row.x, z: row.z, r: row.inner, fade: row.fade ?? row.outer - row.inner };
    if (row.open !== undefined) spot.open = row.open;
    if (row.source === 'mill.wheel') spot.gain = () => (wheel() > 0.01 ? 1 : 0);
    return spot;
  });
}

export function installPineAudio(h: PineAudioHost): void {
  const { game, sky, music, ambience: amb, animals } = h;
  const rows = h.context === undefined ? source.audio : runtimeAudio(h.context, source.audio);
  const spots = pineZoneSpots(() => h.cabins?.wheelSpeed ?? 0, requireAudioProfile(rows.zones, 'ambience.pine'));
  for (const s of spots) amb.addSpot(s);

  // ── doors: every cabin / hamlet door (their prompts flip "Open door" ↔ "Close door") ──
  // a door that moved (a barred one, the mill's (E322), does not): its creak, through the cabins' door listeners
  const doorSound: Parameters<NonNullable<PineAudioHost['cabins']>['onDoor']>[0] = (door, opening) => { amb.sfx.shot(opening ? 'doorOpen' : 'doorClose', { at: door.position }); };
  const retained = h.context !== undefined && retainsRuntimeServices(h.context);
  if (!retained) h.cabins?.onDoor(doorSound);

  const score = pineScore(music);
  const pinned = pineScorePick() !== 'auto'; // Debug ▸ Audio ▸ Pine Hollow score holds the scene (Music.ts reads it)
  const observer:ReturnType<typeof audioObserverSystems>=audioObserverSystems(requireAudioProfile(rows.observations,'pine audio observations'),{
    read:id=>{
      const dn=sky.dayNight,p=game.camera.position;
      switch(id){
        case 'hasClock':return dn?1:0;case 'night':return dn?.night??0;
        case 'pinned':return pinned?1:0;case 'boss':return score.sceneName==='boss'?1:0;
        case 'engaged':return h.eliteEngaged()?1:0;
        case 'listener.x':return p.x;case 'listener.y':return p.y;case 'listener.z':return p.z;
        default:throw new Error(`Unknown audio observation: ${id}`);
      }
    },
    write:(id,value)=>{if(id!=='ambience.night')throw new Error('Unknown audio observation target');amb.night=value;},
    entities:{animals:()=>animals.animals},commands:new Map<string,NonNullable<ReturnType<Parameters<typeof audioObserverSystems>[1]['commands']['get']>>>([
      ['clock.change',(_dt,_t,event)=>{audioLog('wire',event.value===1?'clock:night':'clock:day',true,(sky.dayNight?.night??0).toFixed(2));}],
      ['score.scene',()=>{score.setPineScene(observer.value('audio','night')!==0?'night':'day');}],
      ['elite.change',(_dt,_t,event)=>{audioLog('wire',event.value===1?'elite:engaged':'elite:clear');}],
      ['combat',()=>{music.combat(0.8);}],
      ['deer.snort',(_dt,_t,event)=>{if(event.entity===undefined)throw new Error('Missing audio observation actor');amb.sfx.shot('deer_snort',{at:event.entity.position});}],
    ])
  });
  const system=requireAudioProfile(observer.systems.find(row=>row.id==='audio'),'pine audio system');
  const diagnostic={spots,get night(){return observer.value('audio','night')!==0;}};
  if (retained && h.context !== undefined) {
    installEnteredRuntimeObserver(h.context, '__pineAudio', diagnostic);
    installEnteredRuntimeService(h.context, (scope) => {
      const previousShade = h.audio.ambientShade;
      amb.setActive(true);
      game.app.addSystem(system, scope);
      const stopDoor = h.cabins?.onDoor(doorSound);
      scope.onDispose(() => {
        stopDoor?.();
        amb.setActive(false);
        h.audio.shadeAmbient(previousShade.level, previousShade.cutoff);
      });
    });
  } else {
    game.app.addSystem(system, game.levelScope);
    game.levelScope.expose(window, '__pineAudio', diagnostic);
  }
}
