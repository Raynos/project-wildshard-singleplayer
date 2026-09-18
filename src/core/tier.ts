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
const dbgFlags = (() => { try { return JSON.parse(localStorage.getItem('ws.debug') ?? '{}') as { tier?: string; dpr?: string; aa?: string }; } catch { return {}; } })(); // DBG pill (src/ui/Debug.ts)
const dbgTier = dbgFlags.tier;
const forced = (params.get('tier') ?? (dbgTier === 'phone' || dbgTier === 'desktop' ? dbgTier : null)) as Tier | null;

export const TIER: Tier = forced === 'phone' || forced === 'desktop' ? forced : mobileUA ? 'phone' : 'desktop';

export const TIER_CONFIG = {
  phone: {
    maxTexture: 1024, layerSize: 512, dpr: 1.0, ao: false,
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
    // pond planar reflection: render-target width (height = half), and whether the carpet layers reflect
    reflectionWidth: 512, reflectDetail: false,
    // post: god rays samples / resolution scale, volumetric march steps, SMAA preset
    // 3 full-res SMAA passes are the dearest part of the chain and DPR 1.0 is upscaled ×3 on the screen anyway;
    // volumetrics march at half res into their own target; god rays at a quarter
    godRaysSamples: 24, godRaysScale: 0.25, volumetricSteps: 8, volumetricScale: 0.5, smaa: 'low' as 'off' | 'low' | 'high', bloomLevels: 4, // SMAA low back on: at DPR 1.0 the viewmodel's edges stair-step without it
  },
  desktop: {
    maxTexture: 4096, layerSize: 1024, dpr: 1.5, ao: true,
    cascades: 3, shadowMapSize: 2048, shadowFar: 220, shadowMargin: 120, softShadows: true,
    undergrowthShadows: true, animalShadowDist: 90, animalHideDist: 400, furShells: true,
    treeHiDist: 110, treeLoDist: 210, treeTwigDist: 38, loTreeShadows: true,
    grassRadius: 55, grassSlots: 96, grassQuads: 5,
    undergrowthFar: 110, propsFar: 700, propsMinAngular: 0.0012,
    cabinDetailDist: 160, cabinDetailShadows: true, sharedCabinLights: false, beaconLights: true,
    reflectionWidth: 1024, reflectDetail: true,
    godRaysSamples: 60, godRaysScale: 0.5, volumetricSteps: 14, volumetricScale: 1, smaa: 'high' as 'off' | 'low' | 'high', bloomLevels: 8,
  },
}[TIER];

// DBG overrides (src/ui/Debug.ts): render scale and SMAA, so the sharpness/fps trade-off can be dialled on the phone
if (dbgFlags.dpr && dbgFlags.dpr !== 'auto') TIER_CONFIG.dpr = Number(dbgFlags.dpr);
if (dbgFlags.aa === 'on' && TIER_CONFIG.smaa === 'off') TIER_CONFIG.smaa = 'low';
if (dbgFlags.aa === 'off') TIER_CONFIG.smaa = 'off';
