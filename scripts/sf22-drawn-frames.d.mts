/** An unclamped actual frame-clock interval with the original polling interval and counter coverage alongside it. */
export interface DrawnFrameObservation {
  at: number; dt: number; observedAt: number; polledDt: number; drawnFrame: number; missedFrames: number;
}
/** Observe a completed Game frame using its clock.oldTime value, without calling getDelta/getElapsedTime. */
export interface DrawnFrameSampler {
  sample: (frame: number, drawnAt: number, observedAt: number) => DrawnFrameObservation | null;
}
/** Separate actual drawn-frame cadence from the rAF callback that later notices the frame counter. */
export function createDrawnFrameSampler(): DrawnFrameSampler;
