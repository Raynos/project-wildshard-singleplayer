import type { Wildlife } from '../../creatures/wildlife';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio, HoofSurface, ImpactKind } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import { panFromYaw, audioRandom } from '@wildshard/engine/audio/util';
import { CombatCues } from '@wildshard/engine/combat/cues';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import { wind } from '@wildshard/engine/world/steppeWind';
import { createSteppeScore, type SteppeScene } from './SteppeScore';
/**
 * Nalati's sound (row B16, the audio half): the steppe's creatures, hooves on the ground they cross, the stampede, the
 * grassland bed (wind in the grass by gust strength, the Kunes, the waterfall, the camp stove, larks / crickets), the
 * dusk / night howl chorus, and the kit's own voices (bow twang + arrow whoosh / thud, javelin throw / impact, the
 * sabre's steel, the spear's thrust). The voices are audio/synth.ts's (SteppeVoices) on the engine mixer; this file decides what and where.
 *
 *   const sound = wireSound(nalati, { player, weather, scope, on, debug });   // src/shards/nalati-grasslands/runtime.ts: scoped creature and weapon signals; the flock / dog /
 *                                                            // marmot sounds reach the bound Wildlife callback
 *   sound.bind(audio, music)      // main.ts, once the audio exists: the hoof ground, the steppe bed, the music's 'steppe' mood
 *   sound.fire(weaponId)          // main's weapons.onFire: true = handled here (the kit), false = the old sounds
 *   sound.impact(weaponId, surface, pan, gain)   // main's weapons.onImpact: true = handled here
 *   sound.update(dt)              // every frame (index.ts pushes it)
 *   app.debug.snapshot()['nalati.sound']()  // the scoped live reader: counts, voices, ambience and score
 *
 * NALATI-MERGE A1 / A2 / A4: the bow's draw creak / full-draw click / let-down (Bow.onDrawStart / onFullDraw / onLetDown);
 * the zoned sample beds (src/shards/nalati-grasslands/runtime/audio/SteppeAmbience.ts: Nalati Grasslands / Sky Grassland / Snow Lotus Valley, fed from here at
 * 4 Hz) over the synth bed's fallback; the score's scene (the score source: the zone, night, the storm, the Golden King).
 *
 * Pine Hollow and Driftwood never build this: the call table and the synth bed are registered on Nalati's mixer only.
 */
import * as THREE from 'three';
import { SteppeAmbience } from './SteppeAmbience';
import { installSteppeVoices, STEPPE_BED, type SteppeCall, type SteppeVoices } from './synth';
import type { Nalati } from '../state';
import type { NalatiWeather } from '../../world/installWeather';
import { MELT_STREAM as BROOK } from '../../layout';
import { requireAudioProfile, requireAudioZone } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';

import { RIVER, BRIDGE, riverMask, zoneAt, TERRAIN } from '../../world/terrain';
import { smoothstep } from '@wildshard/engine/core/noise';

import { nalatiCombatCues } from './combatCues';

const PROFILE = requireAudioProfile(source.audio.zones, 'ambience.nalati');
const MUSIC = requireAudioProfile(source.audio.music, 'score.nalati');
const RIVER_ZONE = requireAudioZone(PROFILE, 'river'), BROOK_ZONE = requireAudioZone(PROFILE, 'brook');
const FALL_ZONE = requireAudioZone(PROFILE, 'fall'), CAMP = requireAudioZone(PROFILE, 'camp'), SUMMER_YURTS = requireAudioZone(PROFILE, 'summer');
const MELT_ZONE = requireAudioZone(PROFILE, 'melt');

export interface NalatiSound {
  bind: (audio: Audio, music?: Music, animals?: AnimalManager, wildlife?: Wildlife) => void;
  fire: (cue: string) => boolean;
  impact: (cue: string, surface: ImpactKind, pan: number, gain: number) => boolean;
  update: (dt: number) => void;
  /** a creature sound from the flock / dog / marmots (Wildlife.onSound) */
  emit: (name: string, position: THREE.Vector3) => void;
  /** a wildEnv event ('stampede', 'howl', …) */
  event: (name: string, x: number, z: number) => void;
  /** the tally so far (sound → calls) */
  counts: () => Record<string, number>;
  /** the zoned beds (A4), once bound */
  readonly ambience: SteppeAmbience | null;
  /** the synth voices (audio/synth.ts), once bound */
  readonly voices: SteppeVoices | null;
}

/** the creature names Wildlife / Flock / Marmots send (the AnimalManager ones reach Audio.animal through main.ts) */
const WILD: ReadonlySet<string> = new Set<SteppeCall>(['sheep_bleat', 'dog_bark', 'dog_yelp', 'marmot_whistle', 'wolf_howl', 'wolf_snarl', 'wolf_bite', 'wolf_yip', 'wolf_yelp', 'horse_neigh', 'horse_snort', 'horse_squeal']);
function isAnimalSound(n: string): n is SteppeCall { return WILD.has(n); }


/** the ground under a hoof: the bridge deck, the gravel bars / roads, else turf */
function hoofSurfaceAt(x: number, z: number): HoofSurface {
  if (Math.abs(x - BRIDGE.x) < 3 && Math.abs(z - BRIDGE.z) < BRIDGE.span / 2) return 'wood';
  if (riverMask(x, z) > 0.5 || TERRAIN.trailDistance(x, z) < 2.2) return 'gravel';
  return 'grass';
}

/** metres to the brook's polyline (the meltwater stream), and the side it lies on (`side.x`, `side.z`: a unit vector toward it) */
const side = { x: 0, z: 0 };
function brookDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < BROOK.length - 1; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (!a || !b) continue;
    const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[1]) * vz) / l2)) : 0;
    const px = a[0] + vx * t, pz = a[1] + vz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; side.x = d > 0 ? (px - x) / d : 0; side.z = d > 0 ? (pz - z) / d : 0; }
  }
  return best;
}

export function wireSound(nalati: Pick<Nalati, 'boss' | 'titan'>, ctx: { player: Player; weather: NalatiWeather; scope: Scope; on: ShardContext['on']; debug: ShardContext['debug'] },
  entered?: (install: (scope: Scope) => void) => void): NalatiSound {
  const { player, weather } = ctx;
  let audio: Audio | null = null;
  let voices: SteppeVoices | null = null;
  const _v = new THREE.Vector3();

  /** pan of a world point for the listener (Player.yaw convention: right = (cos yaw, −sin yaw)) */
  const panOf = (x: number, z: number): number => panFromYaw(x - player.position.x, z - player.position.z, player.yaw, 0.8);

  const emit = (name: string, position: THREE.Vector3): void => {
    if (audio && isAnimalSound(name)) audio.animal(name, position, player.position, player.yaw);
  };
  const event = (name: string, x: number, z: number): void => {
    if (!audio || !voices) return;
    if (name === 'stampede') voices.stampede(Math.hypot(x - player.position.x, z - player.position.z), panOf(x, z));
  };

  // ── the kit: the bow's twang carries the draw's power; the spear's thrust vs throw is known only after onFire ──
  let thrustPending = false;
  const cues = new CombatCues(nalatiCombatCues({ ready: () => audio !== null, voices: () => voices, thrust: () => {
    thrustPending = true;
    queueMicrotask(() => { if (thrustPending) { thrustPending = false; voices?.spearThrust(); } });
  } }));
  let manager: AnimalManager | null = null;
  ctx.on('creature.signal', ({ name, x, z }) => { event(name, x, z); });
  ctx.on('weapon.charge', ({ id, phase, value }) => {
    if (id === 'weapon.bow') {
      if (phase === 'draw') cues.cue(value === 1 ? 'cue.bow.full' : 'cue.bow.draw');
      else if (phase === 'letdown') cues.cue('cue.bow.letdown');
      else if (phase === 'loose') cues.cue('cue.bow.loose.power', { strength: value ?? 1 });
    } else if (id === 'weapon.spear' && phase === 'throw') {
      thrustPending = false; cues.cue('cue.spear.throw');
      queueMicrotask(() => { thrustPending = false; });
    }
  });

  // ── the dusk / night chorus: now and then a pack far off answers (never in a storm, never in the kurgan) ──
  let chorusT = 20, bedT = 0;
  let amb: SteppeAmbience | null = null;
  let score: ReturnType<typeof createSteppeScore> | undefined;
  let refresh = (): void => { /* Bound alongside the score. */ };
  const setScene = (scene: Partial<SteppeScene>): void => {
    if (!score) return;
    const before = JSON.stringify(score.scene); Object.assign(score.scene, scene);
    if (JSON.stringify(score.scene) !== before) refresh();
  };
  const chorus = (): void => {
    if (!audio) return;
    const a = audioRandom() * Math.PI * 2, d = 260 + audioRandom() * 330;
    _v.set(player.position.x + Math.cos(a) * d, player.position.y + 20, player.position.z + Math.sin(a) * d);
    audio.animal('wolf_howl', _v, player.position, player.yaw);
  };

  const sound: NalatiSound = {
    bind(a, music, animals, wildlife) {
      const install = (scope: Scope): void => {
        if (animals) manager = animals;
        const previousHoof = a.hoofSurfaceAt, previousBed = a.bedId;
        const m = manager;
        const previousWildlife = wildlife && Object.getOwnPropertyDescriptor(wildlife, 'onSound');
        const previousAnimal = m && Object.getOwnPropertyDescriptor(m, 'onSound');
        if (wildlife) wildlife.onSound = emit;
        audio = a;
        a.hoofSurfaceAt = hoofSurfaceAt;
        voices = installSteppeVoices(a, scope, hoofSurfaceAt);
        // the manager's footfalls are 'hoofsteps' for every animal: only a horse's are hooves — a wolf's or the dog's paws
        // are silent in the grass (bind runs after main.ts sets animals.onSound, so this wraps it)
        let animalSound: AnimalManager['onSound'];
        if (m) {
          animalSound = (name, pos) => {
            if (name === 'hoofsteps') {
              const who = m.animals.find((animal) => animal.position === pos);
              if (who && who.kind !== 'horse') return;
            }
            a.animal(name, pos, player.position, player.yaw);
          };
          m.onSound = animalSound;
        }
        a.setAmbient(STEPPE_BED);
        // A4: the zones' sampled beds (the synth bed stays the fallback); A2: the score follows the zone they report
        if (music) {
          score = createSteppeScore((url) => import('@wildshard/engine/audio/preload').then(({ cachedBytes }) => cachedBytes(url)), (bytes) => import('@wildshard/engine/audio/preload').then(({ decodeBytes }) => decodeBytes(bytes)), () => { music.refreshScore(); });
          refresh = () => { music.refreshScore(); };
          const release = music.setScore(MUSIC.id, score);
          scope.onDispose(release);
          a.onLevelBank((bank) => { score?.useBank(bank.score); }, scope);
        }
        amb = new SteppeAmbience(a);
        scope.onDispose(() => { amb?.dispose(); amb = null; audio = null; voices = null; });
        amb.onZone = (zone) => { setScene({ zone }); };
        if (entered !== undefined) scope.onDispose(() => {
          if (a.hoofSurfaceAt === hoofSurfaceAt) a.hoofSurfaceAt = previousHoof;
          if (a.bedId === STEPPE_BED) a.setAmbient(previousBed);
          if (wildlife?.onSound === emit) {
            if (previousWildlife === undefined) delete wildlife.onSound; else Object.defineProperty(wildlife, 'onSound', previousWildlife);
          }
          if (m && m.onSound === animalSound) {
            if (previousAnimal === null || previousAnimal === undefined) delete m.onSound; else Object.defineProperty(m, 'onSound', previousAnimal);
          }
          thrustPending = false; score = undefined; refresh = () => { /* No entered score. */ };
        });
      };
      if (entered === undefined) install(ctx.scope); else entered(install);
    },
    fire(id) { return id.startsWith('cue.') && cues.cue(id as `cue.${string}`); },
    impact(id, surface, pan, gain) { return id.startsWith('cue.') && cues.cue(id as `cue.${string}`, { surface, pan, gain }); },
    emit, event,
    counts: () => ({ ...audio?.counts }),
    get ambience() { return amb; },
    get voices() { return voices; },
    update(dt) {
      if (!audio) return;
      const p = player.position, clock = weather.clock;
      bedT -= dt;
      if (bedT <= 0) {
        bedT = 1 / PROFILE.tickHz;
        const river = smoothstep(RIVER_ZONE.outer, RIVER_ZONE.inner, Math.abs(p.z - RIVER.z(p.x)) - RIVER.half(p.x)) * RIVER_ZONE.gain;
        const brook = smoothstep(BROOK_ZONE.outer, BROOK_ZONE.inner, brookDistance(p.x, p.z)) * BROOK_ZONE.gain;
        const fall = smoothstep(FALL_ZONE.outer, FALL_ZONE.inner, Math.hypot(p.x - FALL_ZONE.x, p.z - FALL_ZONE.z)) * FALL_ZONE.gain; // the meltwater roaring out from under the glacier's snout
        const camp = Math.max(smoothstep(CAMP.outer, CAMP.inner, Math.hypot(p.x - CAMP.x, p.z - CAMP.z)), SUMMER_YURTS.gain * smoothstep(SUMMER_YURTS.outer, SUMMER_YURTS.inner, Math.hypot(p.x - SUMMER_YURTS.x, p.z - SUMMER_YURTS.z)));
        const night = smoothstep(0.75, 0.45, (0.4 + 0.3 * smoothstep(-14, -2, clock.sunElevation) + 0.3 * smoothstep(-2, 10, clock.sunElevation)));
        // in the kurgan's sealed chamber the steppe is gone (the boss fight has its own sound)
        const out = nalati.boss.inside ? 0 : 1;
        const gust = wind.gustAt(p.x, p.z);
        voices?.setSteppe({ wind: wind.speed * out, gust: gust * out, river: Math.max(river, brook) * out, waterfall: fall * out, camp: camp * out, night: night * out });
        if (amb) {
          const bd = brookDistance(p.x, p.z);
          const panTo = (dx: number, dz: number): number => panFromYaw(dx, dz, player.yaw, 0.7);
          const toCamp = Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < Math.hypot(p.x - SUMMER_YURTS.x, p.z - SUMMER_YURTS.z) ? CAMP : SUMMER_YURTS;
          amb.set({
            zones: zoneAt(p.x, p.z), river, melt: Math.max(fall, smoothstep(MELT_ZONE.outer, MELT_ZONE.inner, bd)), camp, night, wind: wind.speed, gust, out,
            pan: { river: panTo(0, RIVER.z(p.x) - p.z), camp: panTo(toCamp.x - p.x, toCamp.z - p.z), melt: bd < MELT_ZONE.outer ? panTo(side.x, side.z) : panTo(FALL_ZONE.x - p.x, FALL_ZONE.z - p.z) },
          });
        }
        // A2: the score's scene — the King's barrow, a storm (Jel Ata's cue), the night; the zone comes from amb.onZone
        setScene({ night: night > 0.5, storm: weather.weather.stormActive || nalati.titan.engaged, boss: nalati.boss.inside ? 'king' : null });
      }
      amb?.update(dt, p, player.yaw);
      chorusT -= dt;
      if (chorusT <= 0) {
        const dark = clock.dayPhase === 'dusk' || clock.dayPhase === 'night';
        chorusT = dark ? 35 + audioRandom() * 55 : 20;
        if (dark && !weather.weather.stormActive && !nalati.boss.inside) chorus();
      }
    },
  };
  ctx.debug.expose('nalati.sound', () => ({ counts: sound.counts(), voices, ambience: amb, score }));
  return sound;
}
