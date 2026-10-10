/** Read the existing Game clock timestamp only when its completed-draw counter changes. Observer rAF time is
 * retained separately: callback order/jitter can make that polling timestamp a vsync later than the actual draw.
 * No clock method is invoked, no interval is clamped, and missed counter increments stay explicit. */
export function createDrawnFrameSampler() {
  let previous = null;
  return {
    sample(frame, drawnAt, observedAt) {
      if (!Number.isSafeInteger(frame) || frame < 0 || !Number.isFinite(drawnAt) || !Number.isFinite(observedAt)) {
        throw new Error('Invalid drawn-frame observation');
      }
      if (previous !== null && frame === previous.frame) return null;
      if (previous !== null && (frame < previous.frame || drawnAt <= previous.drawnAt || observedAt < previous.observedAt)) {
        throw new Error('Drawn-frame observation moved backwards');
      }
      const prior = previous;
      previous = { frame, drawnAt, observedAt };
      if (prior === null) return null;
      return { at: drawnAt, dt: drawnAt - prior.drawnAt, observedAt,
        polledDt: observedAt - prior.observedAt, drawnFrame: frame, missedFrames: frame - prior.frame - 1 };
    },
  };
}
