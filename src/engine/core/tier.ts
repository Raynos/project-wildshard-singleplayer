import { TIER_TABLE, type EngineTierKnobs } from '../render/tiers';
import type { TierKnobs } from '../level/spec';
import { saveStorage } from '../saves/slots';
/**
 * Quality tier, picked once at boot. Phones get smaller textures, fewer shadow cascades, no AO and a
 * DPR cap — the difference between "loads in minutes then dies" and playable. `?tier=phone|desktop`
 * overrides for testing, else main menu ▸ Settings ▸ Quality (E55, `setting('tier')`). Every knob below is measured in
 * project/archive/2026-09-22-play-perf.md.
 */
import { mobileDevice } from '../render/tierSelect';
import { setting, settingFromUrl } from '../ui/Settings';

const savedStorage = saveStorage('global');

export type Tier = 'phone' | 'desktop';

const mobileUA = mobileDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

/** the tier 'auto' picks on this device (Settings shows it) */
export let automaticTier: Tier = mobileUA ? 'phone' : 'desktop';
export let TIER: Tier = automaticTier;


export const TIER_CONFIG = { ...TIER_TABLE[TIER] };

let buildingAs: Tier | null = null;
/** the tier a model builds at: TIER, or the one Explore's DETAIL TIERS builds it as (explore/tiers.ts `withTier`). A level's
 *  own knob tables (its scatter counts, its detail levels) index by this, as the engine's read TIER_CONFIG. */
export function buildTier(): Tier { return buildingAs ?? TIER; }
/** @internal — explore/tiers.ts `withTier` only */
export function _buildAs(tier: Tier | null): void { buildingAs = tier; }

/**
 * The player's graphics prefs — the menu's Settings ▸ Graphics rows (src/engine/ui/Menu.ts), read once at boot, so a
 * change needs a restart. 'auto' = the tier default above. The old DBG pill kept a tier / dpr / aa / meter
 * override under 'ws.debug'; the pill is gone and that key is dropped once so a stale override stops applying.
 */
export interface GfxPrefs { dpr: 'auto' | '1' | '1.25' | '1.5' | '2' | 'native'; aa: 'auto' | 'on' | 'off' }
const GFX_KEY = 'gfx';
function readGfxPrefs(): GfxPrefs {
  const prefs: GfxPrefs = { dpr: 'auto', aa: 'auto' };
  try {
    const raw = JSON.parse(savedStorage.getItem(GFX_KEY) ?? '{}') as Partial<Record<string, unknown>>;
    const dpr = raw['dpr'], aa = raw['aa'];
    if (dpr === '1' || dpr === '1.25' || dpr === '1.5' || dpr === '2' || dpr === 'native') prefs.dpr = dpr;
    if (aa === 'on' || aa === 'off') prefs.aa = aa;
  } catch { /* private mode / disabled storage: tier defaults */ }
  return prefs;
}
export const gfxPrefs: GfxPrefs = readGfxPrefs();
export function saveGfxPrefs(): void { try { savedStorage.setItem(GFX_KEY, JSON.stringify(gfxPrefs)); } catch { /* private mode */ } }

// 'native' = the screen's own density (the renderer caps at min(devicePixelRatio, dpr)): sharpest, and the costliest fill
export let MOBILE_DEVICE = mobileUA || TIER === 'phone';

export function initializeTier(tier: Tier): void;
export function initializeTier(): Promise<void>;
export function initializeTier(tier?: Tier): void | Promise<void> {
  // Bakers and tier comparisons already name a tier and must retain their synchronous data path.
  if (tier !== undefined) { configureTier(tier); return; }
  return import('../render/tierBoot').then(async ({ bootTier }) => {
    const picked = await bootTier();
    if (picked.via !== 'harness' && picked.via !== 'setting') automaticTier = picked.tier;
    configureTier(picked.tier);
    return undefined;
  });
}
function configureTier(tier: Tier): void {
  TIER = tier;
  Object.assign(TIER_CONFIG, TIER_TABLE[TIER]);
  if (gfxPrefs.dpr !== 'auto') TIER_CONFIG.dpr = gfxPrefs.dpr === 'native' ? 4 : Number(gfxPrefs.dpr);
  if (gfxPrefs.aa === 'on' && TIER_CONFIG.smaa === 'off') TIER_CONFIG.smaa = 'low';
  if (gfxPrefs.aa === 'off') TIER_CONFIG.smaa = 'off';
  MOBILE_DEVICE = mobileUA || TIER === 'phone';
}

/** Resolve the numeric tier row before the level builds sky, forest and carpet. */
export function applyLevelTier(knobs: TierKnobs | undefined): void {
  Object.assign(TIER_CONFIG, TIER_TABLE[TIER]);
  for (const key of Object.keys(TIER_TABLE[TIER]) as (keyof EngineTierKnobs)[]) {
    const value = knobs?.[key];
    if (value !== undefined) Reflect.set(TIER_CONFIG, key, value);
  }
  if (gfxPrefs.dpr !== 'auto') TIER_CONFIG.dpr = gfxPrefs.dpr === 'native' ? 4 : Number(gfxPrefs.dpr);
  if (gfxPrefs.aa === 'on' && TIER_CONFIG.smaa === 'off') TIER_CONFIG.smaa = 'low';
  if (gfxPrefs.aa === 'off') TIER_CONFIG.smaa = 'off';
}

/** a phone or tablet (its user agent), or the phone tier on any device (a headless phone run renders what the phone does) */


/** the on-device perf probe's uncapped rows (src/engine/ui/perfProbe.ts): the frame's real cost, for the probe's own seconds only */
export const frameProbe = { uncapped: false };

/**
 * The frame cap in fps, 0 = none (the display's own rate). Read every frame (a live option).
 *
 * E193 (Jake, 2026-09-26: "Lock all shards to 30 fps on mobile"; "a mobile phone game should never attempt 60 fps but
 * stick to a steady 30"): every shard on a mobile device renders at a locked 30. E189 found why: the iPhone 17 Pro's GPU
 * throttles ~2× within a minute or two of sustained load, so a 60 that holds at first sinks to an uneven 20–30 (Apple,
 * WWDC18 612: lock 30 if 60 cannot hold for ten minutes). No menu pick lifts it on mobile; only the probe's uncapped rows
 * and the test harness's `?fps=60` (scripts measuring the uncapped cost) do. On desktop Settings ▸ Debug ▸ Frame cap 30
 * caps any shard; auto is the display's rate.
 *
 * E290 (Jake, 2026-09-29): the practice arena is the exception, the simplest zone to feel 60 on the device. While it is
 * open (`practiceFps.on`, TrainingArena.enter / exit) mobile is capped at 60, not 30 (a 120 Hz display does not run at
 * 120). iOS Low Power Mode still holds rAF at 30 there.
 */
/** the practice arena is open: the one place mobile targets 60 (E290, below) */
export const practiceFps = { on: false };

export function frameCapFps(): number {
  if (frameProbe.uncapped) return 0;
  const f = setting('fps');
  if (MOBILE_DEVICE) return f === '60' && settingFromUrl('fps') ? 0 : practiceFps.on ? 60 : 30;
  return f === '30' ? 30 : 0;
}
