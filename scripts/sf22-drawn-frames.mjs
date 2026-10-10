/** Observe the browser rAF clock only when the completed-draw counter changes. Callback-start and polling
 * intervals remain diagnostics. No clock method is invoked, no interval clamped, and missed draws stay explicit. */
export function createDrawnFrameSampler() {
  let previous = null;
  return {
    sample(frame, rafAt, startedAt, observedAt) {
      if (!Number.isSafeInteger(frame) || frame < 0 || !Number.isFinite(rafAt)
        || !Number.isFinite(startedAt) || !Number.isFinite(observedAt)) {
        throw new Error('Invalid drawn-frame observation');
      }
      if (previous !== null && frame === previous.frame) return null;
      if (previous !== null && (frame < previous.frame || rafAt <= previous.rafAt
        || startedAt <= previous.startedAt || observedAt < previous.observedAt)) {
        throw new Error('Drawn-frame observation moved backwards');
      }
      const prior = previous;
      previous = { frame, rafAt, startedAt, observedAt };
      if (prior === null) return null;
      return { at: rafAt, dt: rafAt - prior.rafAt, rafDt: rafAt - prior.rafAt, startedAt,
        startedDt: startedAt - prior.startedAt, observedAt, polledDt: observedAt - prior.observedAt,
        drawnFrame: frame, missedFrames: frame - prior.frame - 1 };
    },
  };
}
