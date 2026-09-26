/**
 * Quality tier, picked once at boot. Phones get smaller textures, fewer shadow cascades, no AO and a
 * DPR cap — the difference between "loads in minutes then dies" and playable. `?tier=phone|desktop`
 * overrides for testing, else main menu ▸ Settings ▸ Quality (E55, `setting('tier')`). Every knob below is measured in
 * project/archive/2026-09-22-play-perf.md.
 */
import { setting } from '../ui/Settings';

export type Tier = 'phone' | 'desktop';

const ua = navigator.userAgent;
const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const mobileUA = /iPhone|iPad|iPod|Android/i.test(ua) || isIPadOS;
const forced = setting('tier');

/** the tier 'auto' picks on this device (Settings shows it) */
export const AUTO_TIER: Tier = mobileUA ? 'phone' : 'desktop';
export const TIER: Tier = forced === 'auto' ? AUTO_TIER : forced;

/** both tiers' tables — Explore's DETAIL TIERS view builds a model at the other tier with `withTier` (src/explore/tiers.ts) */
export const TIER_TABLE = {
  phone: {
    maxTexture: 1024, layerSize: 512, dpr: 2, ao: false, // DPR 2 + SMAA on (E70: 1.5 was a ~2× upscale on a 3× iPhone — "really bad and blurry"; 1.0 was already unacceptable); Settings ▸ Render scale overrides (Native = the screen's 3×)
    // shadows: one cascade to 80 m, 1024² — the 2-cascade rig re-drew the whole world twice (9.8 M tris)
    cascades: 1, shadowMapSize: 1024, shadowFar: 80, shadowMargin: 60, softShadows: false,
    // animals shadow as far as the cascade reaches (E90: at 30 m a boar's shadow switched on in plain view)
    undergrowthShadows: false, animalShadowDist: 80, animalHideDist: 150, furShells: false,
    // animal draws (Animal.setDrawLod): fur / hard / eye within animalEyeDist, eyes in the hard material to animalOneDrawDist,
    // then the whole body in the fur material — 3 → 2 → 1 draws per animal
    animalEyeDist: 45, animalOneDrawDist: 100,
    // the far herd (farHerd.ts): past this, a rig is drawn in one draw per model with every other far animal; 0 = off (the
    // phone hides its animals at 150 m)
    animalFarBatchDist: 0,
    // the far herd takes the generated hulls (Pine Hollow) at every distance (one draw per model); off here: the batch keeps a
    // copy of the hull per animal on the GPU
    animalHullBatch: false,
    // the shadow herd (farHerd.ts { shadow }): the casting animals' shadows in one draw per model per cascade
    animalShadowBatch: true,
    // trees: hi cards → lo cards → far card beyond loDist (Forest dissolves lo → far over its last 12 m, twigs over 6 m).
    // E94: the hi cards reach the shadow cascade's edge (80 m; they swapped at 55 m, inside it, so a crown and its
    // shadow changed shape in plain view), so no shadow ever changes shape. The batched path's lo cards share the casting
    // needles mesh (loTreeShadows is the instanced fallback's; past 80 m there is no cascade to cast into). Phone ruler,
    // with Forest's shadow-aware cull: yaw π +0.02–0.17 M triangles (gate 1.32 → 1.42, cabin 1.65 → 1.67, pond
    // 1.39 → 1.56 M); looking down the sunset's shadows (yaw 0.95) +0.19–0.36 M (0.92 → 1.11, 1.35 → 1.61, 1.57 → 1.93 M).
    // Calls unchanged. (Hi to 110 m, E90's palm distance, was another +0.06–0.24 M: pond 2.13 M looking down the shadows.)
    treeHiDist: 80, treeLoDist: 130, treeTwigDist: 24, loTreeShadows: false,
    // grass carpet: ring radius / slots per 4 m cell / quads per clump
    grassRadius: 40, grassSlots: 56, grassQuads: 3,
    undergrowthFar: 60, propsFar: 220, propsMinAngular: 0.004, // a 0.5 m rock lives to 125 m, a boulder to 220 m
    // cabins: hardware / lantern / fire pit / flames only within this; 4 shared point lights follow the nearest cabin
    // instead of 12 in every shader (NUM_POINT_LIGHTS is per-fragment cost on everything, grass included)
    cabinDetailDist: 70, cabinDetailShadows: false, sharedCabinLights: true, beaconLights: false,
    // item pickups (WeaponPickup): the floating item within this, the orb (sphere / rings / motes / sigil) within this
    pickupItemDist: 22, pickupOrbDist: 120,
    // post: god rays samples / resolution scale, volumetric march steps, SMAA preset
    // 3 full-res SMAA passes are the dearest part of the chain and DPR 1.0 is upscaled ×3 on the screen anyway;
    // volumetrics march at half res into their own target; god rays at a quarter
    godRaysSamples: 24, godRaysScale: 0.25, volumetricSteps: 8, volumetricScale: 0.5, smaa: 'low' as 'off' | 'low' | 'high', bloomLevels: 4, // SMAA low back on: at DPR 1.0 the viewmodel's edges stair-step without it
    // Driftwood Isle (low-poly): ocean grid cell over the chunk (m), scatter counts, and which scatters cast shadows
    // (a merged mesh is drawn whole into the shadow map — 80 k bush triangles twice was the phone's 30 fps)
    oceanCell: 4.0, palmCount: 120, palmFrondSegs: 4, bushCount: 170, bushDetail: 0, bushShadows: false, boulderShadows: true,
  },
  desktop: {
    maxTexture: 4096, layerSize: 1024, dpr: 1.5, ao: true,
    cascades: 3, shadowMapSize: 2048, shadowFar: 220, shadowMargin: 120, softShadows: true,
    undergrowthShadows: true, animalShadowDist: 90, animalHideDist: 400, furShells: true,
    // PINE-HOLLOW PH-P2: an eye is under a pixel past ~20 m at 1600×900 and a hoof / antler tine past ~60 m, so the
    // phone's draw LOD at 1.3–1.5× its distances. ~150 animals × 3 draws were half of every Pine Hollow desktop frame;
    // a same-instant A/B at the gate / cabin / lookout / shore (scripts: every rig forced to the LOD, then back) moved
    // no pixel past the frame-to-frame noise, next to a boar too
    animalEyeDist: 60, animalOneDrawDist: 150,
    // PH-P2: ~100 one-draw rigs at 150–400 m were 90–120 draws at the gate / lookout — the far herd draws them per model
    animalFarBatchDist: 150,
    // PH-P2: and the generated hulls at every distance — their batch draws the same pixels near as far (one group, no shells)
    animalHullBatch: true,
    animalShadowBatch: true,
    treeHiDist: 110, treeLoDist: 210, treeTwigDist: 38, loTreeShadows: true,
    grassRadius: 55, grassSlots: 96, grassQuads: 5,
    undergrowthFar: 110, propsFar: 700, propsMinAngular: 0.0012,
    cabinDetailDist: 160, cabinDetailShadows: true, sharedCabinLights: false, beaconLights: true,
    // PINE-HOLLOW PH-P2: the AR-15 floats inside cabin 1 and was ~20 draws + 10 shadow from anywhere in the chunk. A
    // same-instant A/B hiding the whole pickup at 26 / 74 / 165 / 253 m, day and night, moved no pixel past the noise
    // (the walls hide it); in the open a 1 m item is ~8 px at 90 m, and the orb stays a beacon to 200 m
    pickupItemDist: 90, pickupOrbDist: 200,
    godRaysSamples: 60, godRaysScale: 0.5, volumetricSteps: 14, volumetricScale: 1, smaa: 'high' as 'off' | 'low' | 'high', bloomLevels: 8,
    oceanCell: 2.75, palmCount: 150, palmFrondSegs: 6, bushCount: 260, bushDetail: 1, bushShadows: true, boulderShadows: true,
  },
};

export const TIER_CONFIG = TIER_TABLE[TIER];

/**
 * E142 (Pine Hollow on Jake's iPhone: 14 fps / 71 ms in the old-growth): the photoreal shard's phone knobs on top of the
 * phone row. A shard is picked by reloading with `?chunk=` (registry.ts), so the URL names it before any module reads the
 * table (read here directly: importing the registry would load every chunk def ahead of the tier). `?phknobs=0` = the
 * phone row as it was.
 *  - trees hi → lo cards and the shadow cascade at 60 m, not 80 (E94 keeps the two together so no crown or shadow changes
 *    shape in view): fewer full-detail crowns in the main pass and ~40 % less cascade area to draw casters into
 *  - the grass carpet 40 slots per 4 m cell, not 56 (−29 % alpha-tested blades; the bottom half of the screen was blades)
 */
export const PINE_HOLLOW_PHONE = { treeHiDist: 60, shadowFar: 60, animalShadowDist: 60, grassSlots: 40 } as const;
const PAGE_QUERY = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
/** the shard the knobs are set for: the URL's at first; the shard host (src/shard/ShardHost.ts) moves it on a switch */
let tierShard = PAGE_QUERY.get('chunk');
/** the tier row's own values of the keys Pine Hollow's phone knobs override (applyShardTier puts them back for another shard) */
const ROW_BASE: Record<keyof typeof PINE_HOLLOW_PHONE, number> = { treeHiDist: TIER_CONFIG.treeHiDist, shadowFar: TIER_CONFIG.shadowFar, animalShadowDist: TIER_CONFIG.animalShadowDist, grassSlots: TIER_CONFIG.grassSlots };
/**
 * The knobs for `slug` (E155: several shards live in one page): Pine Hollow's phone knobs on, or the phone row's own
 * values back. Build-time readers see the building shard's; the frame cap and pinePhoneCuts read them every frame.
 */
export function applyShardTier(slug: string): void {
  tierShard = slug;
  Object.assign(TIER_CONFIG, TIER === 'phone' && slug === 'pine-hollow' ? PINE_HOLLOW_PHONE : ROW_BASE);
}
if (TIER === 'phone' && tierShard === 'pine-hollow') Object.assign(TIER_CONFIG, PINE_HOLLOW_PHONE);

/**
 * E142, the 30-fps-at-2× lane (Jake: "we should just be doing performance optimizations necessary for hitting 30 FPS
 * at 2"): Pine Hollow's phone-tier cost cuts that keep the picture — the render scale stays 2×: the viewmodel's depth
 * slices, the IBL refreshed in steps, the god rays skipped off screen. E142 wrapped them as the picture (the old
 * `?at2x=0` / `?depthslice=0` A/B switches went in E162).
 */
export function pinePhoneCuts(): boolean {
  return TIER === 'phone' && tierShard === 'pine-hollow';
}

/**
 * E189 (Jake, iPhone 17 Pro: "the FPS tanks from 60 to 20 after about a minute" — the phone's GPU throttling under
 * sustained load): the two E142 cuts that change no pixel — the viewmodel's depth slices and the god rays skipped while
 * the sun is off screen — on Driftwood's phone tier too, not only Pine Hollow's.
 */
export function phonePictureCuts(): boolean {
  return TIER === 'phone' && (tierShard === 'pine-hollow' || tierShard === 'driftwood-isle');
}

/**
 * The player's graphics prefs — the menu's Settings ▸ Graphics rows (src/ui/Menu.ts), read once at boot, so a
 * change needs a restart. 'auto' = the tier default above. The old DBG pill kept a tier / dpr / aa / meter
 * override under 'ws.debug'; the pill is gone and that key is dropped once so a stale override stops applying.
 */
export interface GfxPrefs { dpr: 'auto' | '1' | '1.25' | '1.5' | '2' | 'native'; aa: 'auto' | 'on' | 'off' }
const GFX_KEY = 'ws.gfx.v1';
function readGfxPrefs(): GfxPrefs {
  const prefs: GfxPrefs = { dpr: 'auto', aa: 'auto' };
  try {
    localStorage.removeItem('ws.debug');
    const raw = JSON.parse(localStorage.getItem(GFX_KEY) ?? '{}') as Partial<Record<string, unknown>>;
    const dpr = raw['dpr'], aa = raw['aa'];
    if (dpr === '1' || dpr === '1.25' || dpr === '1.5' || dpr === '2' || dpr === 'native') prefs.dpr = dpr;
    if (aa === 'on' || aa === 'off') prefs.aa = aa;
  } catch { /* private mode / disabled storage: tier defaults */ }
  return prefs;
}
export const gfxPrefs: GfxPrefs = readGfxPrefs();
export function saveGfxPrefs(): void { try { localStorage.setItem(GFX_KEY, JSON.stringify(gfxPrefs)); } catch { /* private mode */ } }

// 'native' = the screen's own density (the renderer caps at min(devicePixelRatio, dpr)): sharpest, and the costliest fill
if (gfxPrefs.dpr !== 'auto') TIER_CONFIG.dpr = gfxPrefs.dpr === 'native' ? 4 : Number(gfxPrefs.dpr);
if (gfxPrefs.aa === 'on' && TIER_CONFIG.smaa === 'off') TIER_CONFIG.smaa = 'low';
if (gfxPrefs.aa === 'off') TIER_CONFIG.smaa = 'off';

/**
 * The frame cap in fps, 0 = none (the display's own rate). PINE-HOLLOW-REMASTER PH-U18 / PH-P1: Pine Hollow's phone
 * tier renders at a locked 30 — a steady 30 reads better than a 40–60 that judders, and the photoreal shard has no
 * headroom for 60 on a phone. Every other shard and tier stays uncapped. Settings ▸ Debug ▸ Frame rate / `?fps=60`
 * lifts it (a test), `?fps=30` caps any shard. Read every frame (a live option).
 */
export function frameCapFps(slug: string): number {
  const f = setting('fps');
  if (f === '30') return 30;
  if (f === '60') return 0;
  return TIER === 'phone' && slug === 'pine-hollow' ? 30 : 0;
}
