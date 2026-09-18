/**
 * Quality tier, picked once at boot. Phones get smaller textures, fewer shadow cascades, no AO and a
 * DPR cap — the difference between "loads in minutes then dies" and playable. `?tier=phone|desktop`
 * overrides for testing.
 */
export type Tier = 'phone' | 'desktop';

const params = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const mobileUA = /iPhone|iPad|iPod|Android/i.test(ua) || isIPadOS;
const forced = params.get('tier') as Tier | null;

export const TIER: Tier = forced === 'phone' || forced === 'desktop' ? forced : mobileUA ? 'phone' : 'desktop';

export const TIER_CONFIG = {
  phone:   { maxTexture: 1024, layerSize: 512,  dpr: 1.25, cascades: 2, ao: false, grassRadius: 40 },
  desktop: { maxTexture: 4096, layerSize: 1024, dpr: 1.5,  cascades: 3, ao: true,  grassRadius: 60 },
}[TIER];
