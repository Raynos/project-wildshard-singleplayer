import type { Wildlife } from '../creatures/wildlife';
import type { ShardContext } from '#game';
import { CombatCues, type Scope, panFromYaw, audioRandom, loadAudio, wind, type Audio, type Music, type Player, type AnimalManager, type HoofSurface, type ImpactKind } from '#engine';
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
 * the zoned sample beds (src/shards/nalati-grasslands/audio/SteppeAmbience.ts: Nalati Grasslands / Sky Grassland / Snow Lotus Valley, fed from here at
 * 4 Hz) over the synth bed's fallback; the score's scene (the score source: the zone, night, the storm, the Golden King).
 *
 * Pine Hollow and Driftwood never build this: the call table and the synth bed are registered on Nalati's mixer only.
 */
import * as THREE from 'three';
import { SteppeAmbience } from './SteppeAmbience';
import { installSteppeVoices, STEPPE_BED, type SteppeCall, type SteppeVoices } from './synth';
import type { Nalati } from '../index';
import type { NalatiWeather } from '../weather';
import { RIVER, BRIDGE, CAMP, SUMMER_YURTS, GLACIER, BROOK, riverMask, zoneAt, TERRAIN } from '../manifest';

const surfaceOf = (surface: string | undefined): ImpactKind => surface === 'wood' || surface === 'flesh' ? surface : 'ground';

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

const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

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

export function wireSound(nalati: Pick<Nalati, 'boss' | 'titan'>, ctx: { player: Player; weather: NalatiWeather; scope: Scope; on: ShardContext['on']; debug: ShardContext['debug'] }): NalatiSound {
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
  const cues = new CombatCues((id, opts) => {
    const v = voices;
    if (audio === null || v === null) return false;
    switch (id) {
      case 'cue.bow.loose': return true; // powered twang is the loose callback, never a second shot sound
      case 'cue.bow.loose.power': v.bowTwang(opts.strength ?? 1); return true;
      case 'cue.bow.draw': v.bowDraw(); return true;
      case 'cue.bow.full': v.bowFullDraw(); return true;
      case 'cue.bow.letdown': v.bowLetDown(); return true;
      case 'cue.spear.throw': v.javelinThrow(); return true;
      case 'cue.sabre.swing': v.sabreSwing(); return true;
      case 'cue.spear.thrust':
        thrustPending = true;
        queueMicrotask(() => { if (thrustPending) { thrustPending = false; voices?.spearThrust(); } });
        return true;
      case 'cue.arrow.hit': v.arrowImpact(surfaceOf(opts.surface), opts.pan ?? 0, opts.gain ?? 1); return true;
      case 'cue.javelin.hit': v.javelinImpact(surfaceOf(opts.surface), opts.pan ?? 0, opts.gain ?? 1); return true;
      case 'cue.sabre.hit': v.sabreHit(surfaceOf(opts.surface), opts.pan ?? 0, opts.gain ?? 1); return true;
      default: return false;
    }
  });
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
      if (animals) manager = animals;
      if (wildlife) wildlife.onSound = emit;
      audio = a;
      a.hoofSurfaceAt = hoofSurfaceAt;
      voices = installSteppeVoices(a, ctx.scope, hoofSurfaceAt);
      // the manager's footfalls are 'hoofsteps' for every animal: only a horse's are hooves — a wolf's or the dog's paws
      // are silent in the grass (bind runs after main.ts sets animals.onSound, so this wraps it)
      const m = manager;
      if (m) {
        m.onSound = (name, pos) => {
          if (name === 'hoofsteps') {
            const who = m.animals.find((animal) => animal.position === pos);
            if (who && who.kind !== 'horse') return;
          }
          a.animal(name, pos, player.position, player.yaw);
        };
      }
      a.setAmbient(STEPPE_BED);
      // A4: the zones' sampled beds (the synth bed stays the fallback); A2: the score follows the zone they report
      if (music) {
        score = createSteppeScore((url) => loadAudio().then((ports) => ports.cachedBytes(url)), (bytes) => loadAudio().then((ports) => ports.decodeBytes(bytes)), () => { music.refreshScore(); });
        refresh = () => { music.refreshScore(); };
        const release = music.setScore('score.nalati', score);
        ctx.scope.onDispose(release);
        a.onLevelBank((bank) => { score?.useBank(bank.score); }, ctx.scope);
      }
      amb = new SteppeAmbience(a);
      ctx.scope.onDispose(() => { amb?.dispose(); amb = null; audio = null; voices = null; });
      amb.onZone = (zone) => { setScene({ zone }); };
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
        bedT = 0.25;
        const river = smooth(70, 6, Math.abs(p.z - RIVER.z(p.x)) - RIVER.half(p.x));
        const brook = smooth(24, 2, brookDistance(p.x, p.z)) * 0.45;
        const fall = smooth(90, 10, Math.hypot(p.x - GLACIER.x1, p.z - GLACIER.z1)) * 0.6; // the meltwater roaring out from under the glacier's snout
        const camp = Math.max(smooth(45, 6, Math.hypot(p.x - CAMP.x, p.z - CAMP.z)), 0.6 * smooth(30, 5, Math.hypot(p.x - SUMMER_YURTS.x, p.z - SUMMER_YURTS.z)));
        const night = smooth(0.75, 0.45, (0.4 + 0.3 * smooth(-14, -2, clock.sunElevation) + 0.3 * smooth(-2, 10, clock.sunElevation)));
        // in the kurgan's sealed chamber the steppe is gone (the boss fight has its own sound)
        const out = nalati.boss.inside ? 0 : 1;
        const gust = wind.gustAt(p.x, p.z);
        voices?.setSteppe({ wind: wind.speed * out, gust: gust * out, river: Math.max(river, brook) * out, waterfall: fall * out, camp: camp * out, night: night * out });
        if (amb) {
          const bd = brookDistance(p.x, p.z);
          const panTo = (dx: number, dz: number): number => panFromYaw(dx, dz, player.yaw, 0.7);
          const toCamp = Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < Math.hypot(p.x - SUMMER_YURTS.x, p.z - SUMMER_YURTS.z) ? CAMP : SUMMER_YURTS;
          amb.set({
            zones: zoneAt(p.x, p.z), river, melt: Math.max(fall, smooth(40, 3, bd)), camp, night, wind: wind.speed, gust, out,
            pan: { river: panTo(0, RIVER.z(p.x) - p.z), camp: panTo(toCamp.x - p.x, toCamp.z - p.z), melt: bd < 40 ? panTo(side.x, side.z) : panTo(GLACIER.x1 - p.x, GLACIER.z1 - p.z) },
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
