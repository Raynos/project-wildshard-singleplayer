// SHARD-PLATFORM M3 (look-family rows): Driftwood's herring gull palette for the SDK gull flock (@wildshard/sdk/looks/gullFlock).
export const GULL_PALETTE = {
  white: '#f3f3ef',
  belly: '#ffffff',
  grey: '#b4bac0',
  greyDark: '#9aa1a8',
  tip: '#2b2e33',
  beak: '#e9a23b',
  leg: '#e08a3a',
  eye: '#1a1a1a',
};
/** the beach perches keep off the pier corridors: |x| < `half` beyond |z| > `beyond`, and the same across */
export const GULL_CORRIDORS = { half: 8, beyond: 150 };

/** Native wheeling and body response; the caller retains its flock clock and wing bursts. */
export const GULL_FLIGHT={wave:0,amplitude:0,pitch:0.7,pitchRate:4,bank:0.9,bankLimit:0.75,bankRate:2.5,directionEpsilon:1e-4};
export const GULL_WHEEL={xAmplitude:0.22,xFrequency:2,zScale:0.85,zAmplitude:0.18,zFrequency:3,altitudeFrequency:0.45,altitudeAmplitude:3.5,detailFrequency:1.7,detailAmplitude:1.2};
