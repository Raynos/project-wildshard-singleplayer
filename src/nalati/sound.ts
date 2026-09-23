/**
 * Nalati's sound (row B16, the audio half): the steppe's creatures, hooves on the ground they cross, the stampede, the
 * grassland bed (wind in the grass by gust strength, the Kunes, the waterfall, the camp stove, larks / crickets), the
 * dusk / night howl chorus, and the kit's own voices (bow twang + arrow whoosh / thud, javelin throw / impact, the
 * sabre's steel, the spear's thrust). Everything plays through `src/audio/Audio.ts`; this file decides what and where.
 *
 *   const sound = wireSound(nalati, { player, weather });   // src/nalati/index.ts: wraps attachAnimals (the flock / dog /
 *                                                            // marmot sounds), bindPlay (the kit's hooks), wildEnv.onEvent
 *   sound.bind(audio, music)      // main.ts, once the audio exists: the hoof ground, the steppe bed, the music's 'steppe' mood
 *   sound.fire(weaponId)          // main's weapons.onFire: true = handled here (the kit), false = the old sounds
 *   sound.impact(weaponId, surface, pan, gain)   // main's weapons.onImpact: true = handled here
 *   sound.update(dt)              // every frame (index.ts pushes it)
 *   audio.counts                  // the tally of every sound played (`window.__nalatiSound.counts()` in a headless check)
 *
 * Pine Hollow and Driftwood never build this; the only engine-side change they could see is none (Audio's new methods
 * and the 'steppe' bed are only reached from here).
 */
import * as THREE from 'three';
import type { Audio, AnimalSound, HoofSurface, ImpactKind } from '../audio/Audio';
import type { Music } from '../audio/Music';
import type { Player } from '../player/Player';
import type { NalatiKit } from '../player/nalatiKit';
import type { Nalati } from './index';
import type { NalatiWeather } from './weather';
import type { AnimalManager } from '../entities/AnimalManager';
import { wind } from '../world/Wind';
import { wildEnv } from '../entities/wildEnv';
import { lightLevel } from '../world/DayNight';
import { trailDistance } from '../world/Heightfield';
import { RIVER, BRIDGE, CAMP, SUMMER_YURTS, WATERFALL, BROOK, riverMask } from '../chunks/nalati-grasslands';

export interface NalatiSound {
  bind: (audio: Audio, music?: Music) => void;
  fire: (weaponId: string) => boolean;
  impact: (weaponId: string, surface: ImpactKind, pan: number, gain: number) => boolean;
  update: (dt: number) => void;
  /** a creature sound from the flock / dog / marmots (Wildlife.onSound) */
  emit: (name: string, position: THREE.Vector3) => void;
  /** a wildEnv event ('stampede', 'howl', …) */
  event: (name: string, x: number, z: number) => void;
  /** the tally so far (sound → calls) */
  counts: () => Record<string, number>;
}

/** the creature names Wildlife / Flock / Marmots send (the AnimalManager ones reach Audio.animal through main.ts) */
const WILD: ReadonlySet<string> = new Set<AnimalSound>(['sheep_bleat', 'dog_bark', 'dog_yelp', 'marmot_whistle', 'wolf_howl', 'wolf_snarl', 'wolf_bite', 'wolf_yip', 'wolf_yelp', 'horse_neigh', 'horse_snort', 'horse_squeal']);
function isAnimalSound(n: string): n is AnimalSound { return WILD.has(n); }

const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** the ground under a hoof: the bridge deck, the gravel bars / roads, else turf */
function hoofSurfaceAt(x: number, z: number): HoofSurface {
  if (Math.abs(x - BRIDGE.x) < 3 && Math.abs(z - BRIDGE.z) < BRIDGE.span / 2) return 'wood';
  if (riverMask(x, z) > 0.5 || trailDistance(x, z) < 2.2) return 'gravel';
  return 'grass';
}

/** metres to the brook's polyline */
function brookDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < BROOK.length - 1; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (!a || !b) continue;
    const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[1]) * vz) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t));
  }
  return best;
}

export function wireSound(nalati: Nalati, ctx: { player: Player; weather: NalatiWeather }): NalatiSound {
  const { player, weather } = ctx;
  let audio: Audio | null = null;
  const _v = new THREE.Vector3();

  /** pan of a world point for the listener (Player.yaw convention: right = (cos yaw, −sin yaw)) */
  const panOf = (x: number, z: number): number => {
    const dx = x - player.position.x, dz = z - player.position.z, d = Math.hypot(dx, dz);
    return d > 0.5 ? ((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d) * 0.8 : 0;
  };

  const emit = (name: string, position: THREE.Vector3): void => {
    if (audio && isAnimalSound(name)) audio.animal(name, position, player.position, player.yaw);
  };
  const event = (name: string, x: number, z: number): void => {
    if (!audio) return;
    if (name === 'stampede') audio.stampede(Math.hypot(x - player.position.x, z - player.position.z), panOf(x, z));
  };

  // ── the kit: the bow's twang carries the draw's power; the spear's thrust vs throw is known only after onFire ──
  let thrustPending = false;
  const bindKit = (kit: NalatiKit): void => {
    const loose = kit.bow.onLoose;
    kit.bow.onLoose = (power) => { loose?.(power); audio?.bowTwang(power); };
    const thrown = kit.spear.onThrow;
    kit.spear.onThrow = () => { thrown?.(); thrustPending = false; audio?.javelinThrow(); };
  };

  // ── self-wiring onto the shard's hooks (the integrator's index.ts calls wireSound once) ──
  let manager: AnimalManager | null = null;
  const attach = nalati.attachAnimals;
  nalati.attachAnimals = (animals) => {
    manager = animals;
    const w = attach(animals);
    const prev = w.onSound;
    w.onSound = (name, pos) => { prev?.(name, pos); emit(name, pos); };
    return w;
  };
  const bindPlay = nalati.bindPlay;
  nalati.bindPlay = (p) => { bindPlay(p); if (p.kit !== null) bindKit(p.kit); };
  const onEvent = wildEnv.onEvent;
  wildEnv.onEvent = (name, x, z) => { onEvent?.(name, x, z); event(name, x, z); };

  // ── the dusk / night chorus: now and then a pack far off answers (never in a storm, never in the kurgan) ──
  let chorusT = 20, bedT = 0;
  const chorus = (): void => {
    if (!audio) return;
    const a = Math.random() * Math.PI * 2, d = 260 + Math.random() * 330;
    _v.set(player.position.x + Math.cos(a) * d, player.position.y + 20, player.position.z + Math.sin(a) * d);
    audio.animal('wolf_howl', _v, player.position, player.yaw);
  };

  const sound: NalatiSound = {
    bind(a, music) {
      audio = a;
      a.hoofSurfaceAt = hoofSurfaceAt;
      // the manager's footfalls are 'hoofsteps' for every animal: only a horse's are hooves — a wolf's or the dog's paws
      // are silent in the grass (bind runs after main.ts sets animals.onSound, so this wraps it)
      const m = manager;
      if (m?.onSound) {
        const prev = m.onSound;
        m.onSound = (name, pos) => {
          if (name === 'hoofsteps') {
            const who = m.animals.find((x) => x.position === pos);
            if (who && who.kind !== 'horse') return;
          }
          prev(name, pos);
        };
      }
      a.setAmbient('steppe');
      music?.setState({ shard: 'steppe' });
    },
    fire(id) {
      if (!audio) return false;
      if (id === 'bow') return true; // the twang comes with the loose's power (bindKit)
      if (id === 'sabre') { audio.sabreSwing(); return true; }
      if (id === 'spear') {
        // a throw calls onFire then onThrow in the same task: only a thrust is still pending after it
        thrustPending = true;
        queueMicrotask(() => { if (thrustPending) { thrustPending = false; audio?.spearThrust(); } });
        return true;
      }
      return false;
    },
    impact(id, surface, pan, gain) {
      if (!audio) return false;
      if (id === 'bow') { audio.arrowImpact(surface, pan, gain); return true; }
      if (id === 'spear') { audio.javelinImpact(surface, pan, gain); return true; }
      if (id === 'sabre') { audio.sabreHit(surface, pan, gain); return true; }
      return false;
    },
    emit, event,
    counts: () => ({ ...audio?.counts }),
    update(dt) {
      if (!audio) return;
      const p = player.position, clock = weather.clock;
      bedT -= dt;
      if (bedT <= 0) {
        bedT = 0.25;
        const river = smooth(70, 6, Math.abs(p.z - RIVER.z(p.x)) - RIVER.half(p.x));
        const brook = smooth(24, 2, brookDistance(p.x, p.z)) * 0.45;
        const fall = smooth(110, 12, Math.hypot(p.x - WATERFALL.x, p.z - WATERFALL.z));
        const camp = Math.max(smooth(45, 6, Math.hypot(p.x - CAMP.x, p.z - CAMP.z)), 0.6 * smooth(30, 5, Math.hypot(p.x - SUMMER_YURTS.x, p.z - SUMMER_YURTS.z)));
        const night = smooth(0.75, 0.45, lightLevel(clock));
        // in the kurgan's sealed chamber the steppe is gone (the boss fight has its own sound)
        const out = nalati.boss.inside ? 0 : 1;
        audio.setSteppe({ wind: wind.speed * out, gust: wind.gustAt(p.x, p.z) * out, river: Math.max(river, brook) * out, waterfall: fall * out, camp: camp * out, night: night * out });
      }
      chorusT -= dt;
      if (chorusT <= 0) {
        const dark = clock.phase === 'dusk' || clock.phase === 'night';
        chorusT = dark ? 35 + Math.random() * 55 : 20;
        if (dark && !weather.weather.stormActive && !nalati.boss.inside) chorus();
      }
    },
  };
  Object.assign(window, { __nalatiSound: sound });
  return sound;
}
