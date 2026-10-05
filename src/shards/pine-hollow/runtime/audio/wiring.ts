import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeObserver, installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { pineScore, pineScorePick } from './score';
import { audioLog } from '@wildshard/engine/audio/audioLog';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
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

const NIGHT_ON = 0.55, NIGHT_OFF = 0.35;
const SNORT_R = 70, SNORT_GAP = 3;

/** The shardfile's exact baked zone rows; only a live mill-wheel query remains a trusted runtime port. */
export function pineZoneSpots(wheel: () => number): ZoneSpot[] {
  return requireAudioProfile(source.audio.zones, 'ambience.pine').zones.map((row) => {
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
  const spots = pineZoneSpots(() => h.cabins?.wheelSpeed ?? 0);
  for (const s of spots) amb.addSpot(s);

  // ── doors: every cabin / hamlet door (their prompts flip "Open door" ↔ "Close door") ──
  // a door that moved (a barred one, the mill's (E322), does not): its creak, through the cabins' door listeners
  const doorSound: Parameters<NonNullable<PineAudioHost['cabins']>['onDoor']>[0] = (door, opening) => { amb.sfx.shot(opening ? 'doorOpen' : 'doorClose', { at: door.position }); };
  const retained = h.context !== undefined && retainsRuntimeServices(h.context);
  if (!retained) h.cabins?.onDoor(doorSound);

  const score = pineScore(music);
  const pinned = pineScorePick() !== 'auto'; // Debug ▸ Audio ▸ Pine Hollow score holds the scene (Music.ts reads it)
  const prev = new WeakMap<Animal, Animal['state']>();
  let night = false, slowT = 0, snortAt = -99, elite = false, eliteT = 0;
  const system: Parameters<ShardContext['system']>[0] = { id: 'audio', phase: 'update', after: ['hud.combat'], before: ['shard.pine.weather.state', 'shard.pine.weather', 'world.life', 'first hints', 'main.frame'], run: (dt, t) => {
    const dn = sky.dayNight;
    if (dn) amb.night = dn.night;
    slowT += dt;
    if (slowT < 0.2) return;
    slowT = 0;
    // the clock → the music's scene (the King's fight owns it while it runs)
    if (dn) {
      const was = night;
      night = night ? dn.night > NIGHT_OFF : dn.night > NIGHT_ON;
      if (night !== was) audioLog('wire', night ? 'clock:night' : 'clock:day', true, dn.night.toFixed(2));
      if (!pinned && score.sceneName !== 'boss') score.setPineScene(night ? 'night' : 'day');
    }
    // an engaged elite: combat, refreshed each second (Music.combat decays to alert 8 s after the last one)
    const on = h.eliteEngaged();
    if (on !== elite) { elite = on; audioLog('wire', on ? 'elite:engaged' : 'elite:clear'); }
    if (on && t - eliteT > 1) { eliteT = t; music.combat(0.8); }
    // a deer's alarm snort: one going alert near you (not one already running), one snort per few seconds
    const p = game.camera.position;
    for (const a of animals.animals) {
      const was = prev.get(a);
      prev.set(a, a.state);
      if (a.kind !== 'deer' || !a.alive || a.state !== 'alert' || was === undefined || was === 'alert' || was === 'flee') continue;
      if (t - snortAt < SNORT_GAP || a.position.distanceToSquared(p) > SNORT_R * SNORT_R) continue;
      snortAt = t;
      amb.sfx.shot('deer_snort', { at: a.position });
    }
  } };
  const diagnostic = { spots, get night() { return night; } };
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
    Object.assign(window, { __pineAudio: diagnostic });
  }
}
