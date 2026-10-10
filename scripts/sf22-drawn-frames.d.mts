/** Delivered-frame interval with callback-start and polling intervals and counter coverage alongside it. */
export interface DrawnFrameObservation {
  at: number; dt: number; rafDt: number; startedAt: number; startedDt: number;
  observedAt: number; polledDt: number; drawnFrame: number; missedFrames: number;
}
/** Observe a completed Game frame using frameRafTime, clock.oldTime and the polling callback timestamp. */
export interface DrawnFrameSampler {
  sample: (frame: number, rafAt: number, startedAt: number, observedAt: number) => DrawnFrameObservation | null;
}
/** Separate delivered-draw cadence from callback-start jitter and the callback that later notices the counter. */
export function createDrawnFrameSampler(): DrawnFrameSampler;
