/** Infer the observed timestamp step from distinct frame intervals, preserving the raw intervals separately.
 * Six decimal places remove IEEE subtraction residue, not browser timestamp precision. An unvarying sample
 * cannot establish a quantum and returns null rather than assuming Chromium's usual 0.1 ms step. */
export function observedTimestampQuantum(intervals) {
  const values = [...new Set(intervals.filter(value => Number.isFinite(value) && value > 0)
    .map(value => Number(value.toFixed(6))))].sort((a, b) => a - b);
  if (values.length < 3) return null;
  let step = Infinity;
  for (let index = 1; index < values.length; index++) {
    const previous = values[index - 1], current = values[index];
    if (previous !== undefined && current !== undefined) step = Math.min(step, current - previous);
  }
  return Number.isFinite(step) && step > 0 ? Number(step.toFixed(6)) : null;
}

/** Grade crossing p95 against this session's standing ruler within one measured clock quantum.
 * Every standing p95 must itself match the unchanged limit within that quantum. The smallest standing p95
 * is the conservative reference; raw numbers and the observed quantum belong in the receipt. */
export function cadenceWithinQuantum(crossingP95, standingP95, quantum, limit = 33.3) {
  if (!Number.isFinite(crossingP95) || quantum === null || !Number.isFinite(quantum) || quantum <= 0
    || standingP95.length === 0 || standingP95.some(value => !Number.isFinite(value))) return false;
  const equalWithinStep = (value, reference) => Number((value - reference).toFixed(6)) <= quantum;
  return standingP95.every(value => equalWithinStep(value, limit)) && equalWithinStep(crossingP95, Math.min(...standingP95));
}
