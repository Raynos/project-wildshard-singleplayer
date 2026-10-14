/** Shipping direct-anchor cable and release values, shared by page and native riders. */
export const ZIPLINE = { kind: 'zipline', id: 'pine.zipline', sag: 1.2, hang: 3.15, gravity: 9.8, drag: 0.012, maxSpeed: 16 } as const;
export const ZIP_RIDE = { anchors: 'direct', start: 0.7, release: 2,
  landing: { back: 0.6, deck: 0.05, velocity: 2.5 } } as const;
