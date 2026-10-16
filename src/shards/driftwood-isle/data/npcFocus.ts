/** Existing attention laws; gesture acceptance and clocks remain with each NPC. */
export const CASTAWAY_FACING = { range: 6, rate: 3, maxSpeed: 2.2, wrapTarget: true, wrapOutput: true } as const;
export const TRADER_FACING = { range: 6, rate: 3, maxSpeed: 2.2, wrapTarget: true, wrapOutput: true } as const;
export const CASTAWAY_HEAD_FOCUS = {
  range: 9, yawLimit: 1.1, pitchLimit: .4, pitchScale: 1, eyeHeight: 1.6, minimumDistance: .5,
  response: 'linear', rate: 5, clampAfterOffset: false,
  idle: { cadence: { kind: 'sine', base: 2.5, frequency: 1.7, span: 2 }, yaw: [.37, .8], pitch: .15 },
} as const;
export const TRADER_HEAD_FOCUS = {
  range: 11, yawLimit: .9, pitchLimit: .4, pitchScale: 1, eyeHeight: 1.6, minimumDistance: .5,
  response: 'linear', rate: 5, clampAfterOffset: true,
  idle: { cadence: { kind: 'sine', base: 2, frequency: 1.9, span: 1.8 }, yaw: [.41, .75],
    pitch: { frequency: .7, threshold: .4, above: .35, below: .05 } },
} as const;
