/** the shore's boulders (Boulders.ts, Explore's Boulder): beach granite, a shade lighter than the reef */
export const SHORE_ROCK = {
  foot: '#2f3134', dark: '#45474c', mid: '#5f6165', light: '#7f7e7c', edge: '#918f8b', warm: '#776e63', cool: '#535b64', crease: '#2a2d33',
  moss: '#62853a', mossLight: '#8ea24f', mossDark: '#40602b', wet: '#2e3a36',
};
/** the wreck's reef rocks (Wreck.ts), the cove's loose rocks, the pebbles: weedier basalt, a warmer grey (E310 T2 B: lifted
 * ~25 % from the old charcoal, still heavy, never black in shade) */
export const REEF_ROCK = {
  foot: '#3a3836', dark: '#535050', mid: '#726e69', light: '#958f87', edge: '#a8a198', warm: '#8a7f72', cool: '#63666a', crease: '#35333a',
  moss: '#62853a', mossLight: '#8ea24f', mossDark: '#3d5d2a', wet: '#34403b',
};

/** Numeric soft-polytope profiles; the sculptor owns sampling and draw order. */
export const ROCK_PROFILES = {
  dome: { bevels: [5, 7], bevelY: [0.5, 0.8], tilt: [0, 0.15], top: [0.86, 0.94], softness: [0.09, 0.12], noiseAmplitude: 0.14, heightScale: 1.04 },
  table: { bevels: [3, 5], bevelY: [0.45, 0.7], tilt: [0.04, 0.2], top: [0.6, 0.7], softness: [0.05, 0.07], noiseAmplitude: 0.1, heightScale: 0.88 },
  wedge: { bevels: [3, 5], bevelY: [0.45, 0.7], tilt: [0.32, 0.5], top: [0.72, 0.8], softness: [0.05, 0.07], noiseAmplitude: 0.1, heightScale: 1 },
  block: { bevels: [3, 5], bevelY: [0.45, 0.7], tilt: [0.04, 0.2], top: [0.74, 0.82], softness: [0.04, 0.055], noiseAmplitude: 0.1, heightScale: 1 },
} as const;

/** Relative frequencies for the main rock body. Pebbles use dome/block only. */
export const ROCK_KINDS = ['dome', 'table', 'wedge', 'block', 'table', 'block'] as const;
