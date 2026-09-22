/**
 * Quality tier, picked once at boot. Phones get smaller textures, fewer shadow cascades, no AO and a
 * DPR cap — the difference between "loads in minutes then dies" and playable. `?tier=phone|desktop`
 * overrides for testing. Every knob below is measured in docs/plans/PLAY-PERF.md.
 */
export type Tier = 'phone' | 'desktop';

const params = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const mobileUA = /iPhone|iPad|iPod|Android/i.test(ua) || isIPadOS;
const forced = params.get('tier');

export const TIER: Tier = forced === 'phone' || forced === 'desktop' ? forced : mobileUA ? 'phone' : 'desktop';

export const TIER_CONFIG = {
  phone: {
    maxTexture: 1024, layerSize: 512, dpr: 1.5, ao: false, // DPR 1.5 + SMAA on: confirmed by the user as the phone default (the crossbow at 1.0 was unacceptable); Settings ▸ Render scale overrides
    // shadows: one cascade to 80 m, 1024² — the 2-cascade rig re-drew the whole world twice (9.8 M tris)
    cascades: 1, shadowMapSize: 1024, shadowFar: 80, shadowMargin: 60, softShadows: false,
    undergrowthShadows: false, animalShadowDist: 30, animalHideDist: 150, furShells: false,
    // trees: hi cards → lo cards → far card beyond loDist; lo trees never cast shadows (they are past shadowFar)
    treeHiDist: 55, treeLoDist: 130, treeTwigDist: 24, loTreeShadows: false,
    // grass carpet: ring radius / slots per 4 m cell / quads per clump
    grassRadius: 40, grassSlots: 56, grassQuads: 3,
    undergrowthFar: 60, propsFar: 220, propsMinAngular: 0.004, // a 0.5 m rock lives to 125 m, a boulder to 220 m
    // cabins: hardware / lantern / fire pit / flames only within this; 4 shared point lights follow the nearest cabin
    // instead of 12 in every shader (NUM_POINT_LIGHTS is per-fragment cost on everything, grass included)
    cabinDetailDist: 70, cabinDetailShadows: false, sharedCabinLights: true, beaconLights: false,
    // item pickups (WeaponPickup): the floating item within this, the orb (sphere / rings / motes / sigil) within this
    pickupItemDist: 22, pickupOrbDist: 120,
    // pond planar reflection: render-target width (height = half), and whether the carpet layers reflect
    reflectionWidth: 512, reflectDetail: false,
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
    treeHiDist: 110, treeLoDist: 210, treeTwigDist: 38, loTreeShadows: true,
    grassRadius: 55, grassSlots: 96, grassQuads: 5,
    undergrowthFar: 110, propsFar: 700, propsMinAngular: 0.0012,
    cabinDetailDist: 160, cabinDetailShadows: true, sharedCabinLights: false, beaconLights: true,
    pickupItemDist: Infinity, pickupOrbDist: Infinity,
    reflectionWidth: 1024, reflectDetail: true,
    godRaysSamples: 60, godRaysScale: 0.5, volumetricSteps: 14, volumetricScale: 1, smaa: 'high' as 'off' | 'low' | 'high', bloomLevels: 8,
    oceanCell: 2.75, palmCount: 150, palmFrondSegs: 6, bushCount: 260, bushDetail: 1, bushShadows: true, boulderShadows: true,
  },
}[TIER];

/**
 * The player's graphics prefs — the menu's Settings ▸ Graphics rows (src/ui/Menu.ts), read once at boot, so a
 * change needs a restart. 'auto' = the tier default above. The old DBG pill kept a tier / dpr / aa / meter
 * override under 'ws.debug'; the pill is gone and that key is dropped once so a stale override stops applying.
 */
export interface GfxPrefs { dpr: 'auto' | '1' | '1.25' | '1.5'; aa: 'auto' | 'on' | 'off' }
const GFX_KEY = 'ws.gfx.v1';
function readGfxPrefs(): GfxPrefs {
  const prefs: GfxPrefs = { dpr: 'auto', aa: 'auto' };
  try {
    localStorage.removeItem('ws.debug');
    const raw = JSON.parse(localStorage.getItem(GFX_KEY) ?? '{}') as Partial<Record<string, unknown>>;
    const dpr = raw['dpr'], aa = raw['aa'];
    if (dpr === '1' || dpr === '1.25' || dpr === '1.5') prefs.dpr = dpr;
    if (aa === 'on' || aa === 'off') prefs.aa = aa;
  } catch { /* private mode / disabled storage: tier defaults */ }
  return prefs;
}
export const gfxPrefs: GfxPrefs = readGfxPrefs();
export function saveGfxPrefs(): void { try { localStorage.setItem(GFX_KEY, JSON.stringify(gfxPrefs)); } catch { /* private mode */ } }

if (gfxPrefs.dpr !== 'auto') TIER_CONFIG.dpr = Number(gfxPrefs.dpr);
if (gfxPrefs.aa === 'on' && TIER_CONFIG.smaa === 'off') TIER_CONFIG.smaa = 'low';
if (gfxPrefs.aa === 'off') TIER_CONFIG.smaa = 'off';
