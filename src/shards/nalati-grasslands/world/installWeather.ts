import { wildEnv } from '../creatures/env';
import { clockForSun, steppeClock, nightKeys, blendSteppeKey } from '../look/dayKeys';
import { type SkyKey as SteppeKey, SkyRig, makeLook, copyLook, type SkyLook } from '../look/skyRig';
/**
 * Nalati weather + day/night wiring (row B10 of project/archive/2026-09-23-nalati.md): the clock, the storm state machine, the storm's
 * visuals, and everything they touch — the sky rig (sun / moon, sky, fog, grade), the one Wind, the creatures'
 * `wildEnv` (light, storm), the HUD chip + GET LOW warning (the `ws:weather` event), the audio beds and thunder.
 *
 *   const w = wireWeather({ game, sky, player, forest, pois });   // src/shards/nalati-grasslands/index.ts, the weather section
 *   w.update(dt)                                                  // every frame (index.ts pushes it)
 *   w.bind({ audio, hurt, scare })                                // main.ts, once the audio / health exist (see below)
 *   w.clock    — DayClock: .phase ('dawn' | 'day' | 'golden' | 'dusk' | 'night'), .hour, .onDusk / onNight / onDawn(fn)
 *   w.weather  — Weather: .state, .stormActive, .onStrike(fn), .onPhase(fn), .hold (a boss fight), .force(phase)
 *
 * Dev params: `?time=dawn|day|noon|golden|dusk|night|midnight|<hour>` ·
 * `?clock=0` (freeze the clock) · `?weather=clear|building|gust|storm|clearing|after[:0..1]` (jump into a phase,
 * optionally part-way). `window.__weather` = the lot.
 *
 * Hooks for other rows: B11 balbals `w.clock.onDusk(…)`, ghost riders `w.clock.onNight(…)`; B12 Qyran and B14 the
 * Storm Titan read `w.weather.stormActive` / `onPhase`; B13 sets `w.weather.hold = true` during a boss fight; the
 * herds / packs: `w.weather.onStrike((s) => wildlife.scare(s.x, s.z, 60))` (or pass `scare` to `bind`).
 */
import * as THREE from 'three';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Game } from '@wildshard/engine/core/Game';
import { TIER } from '@wildshard/engine/core/tier';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { Player } from '@wildshard/engine/player/Player';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { DayCycle, DayPhase } from '@wildshard/engine/world/dayCycle';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { steppeVoices } from '../runtime/audio/synth';
import type { SteppeStorm as Weather, Exposed, LightningPlayer } from './Weather';
import { steppeStorm, stormWind, stepStorm, stormEnv, yurtsOf, yurtShelters, exposeTrees, type YurtCircle } from './weatherStep';
import { STORM_PHASES } from './weatherProfile';
import { WeatherFX } from './WeatherFX';
import { waterOf } from '../water';
import { smoothstep } from '@wildshard/engine/core/noise';

type WeatherHUD = Parameters<HUD['setWeather']>[0];
declare module '@wildshard/engine/events/maps' { interface EventMap { 'weather.changed': WeatherHUD } }

export interface WeatherCtx {
  ctx: ShardContext; manifest: ShardManifest;
  game: Game; sky: Sky; player: Player; forest: Forest; colliders?: Collider[];
  /** the river / brook / waterfall (src/shards/nalati-grasslands/water.ts): its unlit colours are dimmed with the light (night, storm) */
  water?: THREE.Object3D;
}

export interface WeatherHooks {
  audio?: Audio;
  /** damage the player (health, flash, toast) — the lightning strike */
  hurt?: (damage: number, why: string) => void;
  /** a strike landed: scare the creatures near it (Wildlife.scare) */
  scare?: (x: number, z: number) => void;
  /**
   * The player is somewhere the weather cannot reach (the great kurgan's dungeon, `boss.inside`): no lightning at
   * them, no GET LOW, no rain / storm audio around them — and, since that is where the Golden King is fought, no
   * storm may start meanwhile (`weather.hold`).
   */
  indoors?: () => boolean;
  /**
   * The Storm Titan's fight is on (B14, src/shards/nalati-grasslands/stormTitan.ts): the storm that called him may not run out until he
   * falls (the storm phase is held open), no new storm cycle starts, and the natural lightning leaves the player alone —
   * his strikes take its place. Combined with `indoors` into `weather.hold`, never overwritten by it.
   */
  stormHold?: () => boolean;
}

export interface NalatiWeather {
  clock: DayCycle<SteppeKey>;
  weather: Weather;
  rig: SkyRig;
  fx: WeatherFX;
  /** the look applied last frame (clock + storm) */
  look: SkyLook;
  /** the yurts the lightning's shelter rule reads (world/weatherStep.ts yurtsOf over the POI colliders; the headless bake's `yurts`) */
  readonly yurts: readonly YurtCircle[];
  update: (dt: number) => void;
  bind: (hooks: WeatherHooks) => void;
}

const TIME_NAMES = ['dawn', 'day', 'noon', 'golden', 'dusk', 'night', 'midnight'] as const;
function isTimeName(s: string): s is DayPhase | 'noon' | 'midnight' { return (TIME_NAMES as readonly string[]).includes(s); }
const mmss = (s: number): string => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

// the storm's slate palette (× the hour's own light level)
const SLATE_ZENITH = new THREE.Color(0.12, 0.13, 0.19);
const SLATE_HORIZON = new THREE.Color(0.3, 0.31, 0.38);
const SLATE_FOG = new THREE.Color(0.17, 0.18, 0.23);
const SLATE_HEMI = new THREE.Color(0.42, 0.46, 0.58);
const SLATE_SHADE = new THREE.Color(0.13, 0.14, 0.22);
const SLATE_CLOUD = new THREE.Color(0.36, 0.38, 0.46);
const STORM_KEY = new THREE.Color(0.78, 0.82, 0.95);
const FLASH = new THREE.Color(0.85, 0.82, 1.0);
const _c = new THREE.Color();

/** the storm over the hour's look: gloom, slate, fog, flat light — and the lightning flash on top */
function stormLook(L: SkyLook, w: Weather): void {
  const s = w.overcast, fl = w.flash, rain = w.rain;
  // how bright the hour is (the slate palette scales with it, so a night storm stays dark between flashes)
  const nf = Math.min(1, Math.max(0.1, (L.horizon.r + L.horizon.g + L.horizon.b) / 2.2));
  if (s > 0) {
    L.keyIntensity *= 1 - 0.82 * s;
    L.keyColor.lerp(STORM_KEY, s * 0.6);
    L.disc *= 1 - smoothstep(0.25, 0.75, s);
    L.zenith.lerp(_c.copy(SLATE_ZENITH).multiplyScalar(nf), s);
    L.horizon.lerp(_c.copy(SLATE_HORIZON).multiplyScalar(nf), s);
    L.glow.multiplyScalar(1 - s);
    L.stars *= 1 - s;
    L.hemiSky.lerp(_c.copy(SLATE_HEMI).multiplyScalar(nf), s * 0.8);
    L.hemiIntensity *= 1 + 0.2 * s;
    L.envIntensity *= 1 - 0.4 * s;
    L.fogColor.lerp(_c.copy(SLATE_FOG).multiplyScalar(nf), s);
    L.fogSunColor.lerp(_c.copy(SLATE_FOG).multiplyScalar(nf * 1.2), s);
    L.shadeTint.lerp(_c.copy(SLATE_SHADE).multiplyScalar(nf), s * 0.7);
    L.rimColor.multiplyScalar(1 - 0.7 * s);
    L.cloudLight.lerp(_c.copy(SLATE_CLOUD).multiplyScalar(nf), s);
    L.planetOpacity *= 1 - 0.85 * s;
    L.saturation -= 0.28 * s;
    L.shadowTint.lerp(_c.setRGB(0.9, 0.97, 1.12), s);
    L.highTint.lerp(_c.setRGB(0.95, 0.98, 1.05), s);
    L.volStrength *= 1 - s;
    L.godRays *= 1 - s;
  }
  // rain thickens the air: fog to ~60 m in the downpour
  L.fogDist += 0.002 * s + 0.009 * rain;
  L.fogHeightDensity += 0.003 * rain;
  // the wet after: a cleaner, more saturated world (the rainbow shot)
  const after = w.wet * (1 - s);
  if (after > 0) { L.saturation += 0.12 * after; L.highTint.lerp(_c.setRGB(1.08, 1.02, 0.92), 0.4 * after); }
  // the lightning flash lights the whole world for a frame or two
  if (fl > 0) {
    L.hemiIntensity += 2.6 * fl;
    L.hemiSky.lerp(FLASH, fl);
    L.fogColor.lerp(_c.copy(FLASH).multiplyScalar(0.55), fl * 0.6);
    L.cloudLight.lerp(FLASH, fl * 0.7);
  }
}

/**
 * The river's shader is unlit (its colours are painted): its light follows the hour and the storm through the water's
 * own setters (src/shards/nalati-grasslands/water.ts `setLight` / `setRain`), so the water doesn't glow at night and rain rings its surface.
 */
function waterDimmer(root: THREE.Object3D | undefined): ((L: SkyLook, dayFog: number, dayKey: number, rain: number) => void) | null {
  const water = root ? waterOf(root) : null;
  if (!water) return null;
  const lum = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const sky = new THREE.Color(), sun = new THREE.Color(), baseSun = water.sunColor.clone();
  return (L, dayFog, dayKey, rain) => {
    const k = Math.min(1, Math.max(0.06, lum(L.fogColor) / Math.max(1e-3, dayFog)));
    sky.copy(L.horizon).lerp(L.zenith, 0.35);
    sun.copy(baseSun).multiply(L.keyColor).multiplyScalar(L.keyIntensity / Math.max(1e-3, dayKey));
    water.setLight({ brightness: k, sky, sun });
    water.setRain(rain);
  };
}

export function wireWeather(ctx: WeatherCtx): NalatiWeather {
  const { game, sky, player, forest } = ctx;
  const def = ctx.manifest;
  const qs = ctx.ctx.app.params;
  const hooks: WeatherHooks = {};
  /** refreshed each frame from `hooks.indoors` */
  let indoors = false;

  // ── the clock: starts on the def's own sun, so the first frame is the look the shard was painted with ──
  const clock = def.sky.sun ? clockForSun(def.sky.sun) : steppeClock();
  const tq = qs.get('time');
  if (tq) { const h = Number.parseFloat(tq); if (Number.isFinite(h)) void clock.set(h); else if (isTimeName(tq)) void clock.set(tq); }
  clock.paused = qs.get('clock') === '0';

  const rig = new SkyRig(game, sky, { frames: nightKeys, blend: blendSteppeKey }, def);
  const base = makeLook(), look = makeLook();
  const dimWater = waterDimmer(ctx.water);
  const dayFog = 0.2126 * rig.dayFog.r + 0.7152 * rig.dayFog.g + 0.0722 * rig.dayFog.b, dayKey = Math.max(0.1, rig.daySunIntensity);

  // ── the lightning's view of the world ──
  const yurts = yurtsOf(ctx.colliders ?? []);
  let held = false;   // the Storm Titan's hold (hooks.stormHold), read by the lightning's player() below
  const lp: LightningPlayer = { x: 0, y: 0, z: 0, crouched: false, mounted: false, sheltered: false };
  const weather = steppeStorm(def.seed, {
    heightAt,
    exposed(x: number, z: number, r: number, out: Exposed[]) { exposeTrees(forest.nearby(x, z, r), (t) => t.y + t.height, (t) => t, x, z, r, out); },
    player() {
      const p = player.position;
      lp.x = p.x; lp.y = p.y; lp.z = p.z;
      lp.crouched = player.crouching; lp.mounted = wildEnv.playerMounted;
      lp.sheltered = indoors || held || yurtShelters(yurts, p.x, p.z);
      return lp;
    },
  });
  const wq = qs.get('weather');
  if (wq) {
    const [ph = '', at = '0'] = wq.split(':');
    const phase = STORM_PHASES.find((p) => p === ph);
    if (phase) weather.force(phase, Number.parseFloat(at) || 0);
  }

  const fx = new WeatherFX({ phone: TIER === 'phone', seed: def.seed }).build();
  game.scene.add(fx.group);

  weather.onTelegraph((s) => {
    fx.telegraph(s);
    const d = Math.hypot(s.x - player.position.x, s.z - player.position.z);
    if (d < 160 && hooks.audio) steppeVoices(hooks.audio).lightningCrackle(panOf(s.x, s.z), Math.max(0.15, 1 - d / 160));
  });
  weather.onStrike((s) => {
    fx.bolt(s);
    hooks.scare?.(s.x, s.z);
  });
  weather.onFlash((dist, bearing) => {
    fx.inCloudFlash(bearing);
    const p = player.position;
    if (hooks.audio) steppeVoices(hooks.audio).thunder(dist, panOf(p.x + Math.cos(bearing) * 100, p.z + Math.sin(bearing) * 100));
  });
  weather.onPlayerHit((dmg) => hooks.hurt?.(game.app.events.ask('weather.damage', dmg), 'Struck by lightning — get low in a storm'));

  /** stereo pan of a world point for the listener (Player.yaw convention: forward = (−sin, −cos)) */
  function panOf(x: number, z: number): number {
    const dx = x - player.position.x, dz = z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 1) return 0;
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    return ((dx * rx + dz * rz) / d) * 0.7;
  }

  // ── the wind: the storm asks for its own; back to the calm prevailing westerly after ──
  const windAsk = stormWind(wind);

  // ── HUD + audio, throttled ──
  let hudKey = '';
  let audioT = 0;

  const out: NalatiWeather = {
    clock, weather, rig, fx, look, yurts,
    bind(h) { Object.assign(hooks, h); },
    update(dt) {
      indoors = hooks.indoors?.() === true;
      held = hooks.stormHold?.() === true;
      // the Golden King is fought indoors (no storm starts meanwhile); the Storm Titan in the storm that called him
      weather.hold = indoors || held;
      clock.update(dt);
      // the storm (the Storm Titan's holds it open) and the wind it asks for (world/weatherStep.ts, the host's rule too)
      stepStorm(weather, windAsk, wind, dt, held);
      // the look
      rig.look(clock, base);
      copyLook(look, base);
      stormLook(look, weather);
      rig.flash = weather.flash * 0.7;
      rig.apply(look, dt);
      dimWater?.(look, dayFog, dayKey, indoors ? 0 : weather.rain);
      fx.update(dt, weather, look, game.camera, { x: wind.dirX * wind.speed, z: wind.dirZ * wind.speed });
      fx.rain.visible &&= !indoors;
      // the creatures
      stormEnv(wildEnv, clock, weather);
      // HUD (the event fires on change only)
      const ws = `WIND ${Math.round(wind.speed)} m/s`;
      let chip: WeatherHUD['chip'] = null;
      if (weather.state === 'building' && weather.untilStorm <= 45) chip = { title: `Storm in ${mmss(weather.untilStorm)}`, sub: ws, tone: 'soon' };
      else if (weather.state === 'gust') chip = { title: 'Storm', sub: ws, tone: 'storm' };
      else if (weather.state === 'storm') chip = { title: `Storm ${mmss(weather.phaseLeft)}`, sub: ws, tone: 'storm' };
      else if (weather.state === 'clearing') chip = { title: 'Clearing', sub: ws, tone: 'clearing' };
      const detail: WeatherHUD = { chip, getLow: weather.getLow && !indoors };
      const key = `${chip?.title ?? ''}|${chip?.sub ?? ''}|${String(detail.getLow)}`;
      if (key !== hudKey) { hudKey = key; ctx.ctx.app.events.emit('weather.changed', detail); }
      // audio beds at 4 Hz
      audioT -= dt;
      if (audioT <= 0 && hooks.audio) {
        audioT = 0.25;
        const windLevel = smoothstep(6, 22, wind.speed);
        steppeVoices(hooks.audio).setStorm(indoors ? 0 : weather.rain, indoors || weather.state === 'clear' ? 0 : windLevel);
      }
    },
  };
  ctx.ctx.debug.expose('nalati.weather', out);
  return out;
}
