/** Test-only design, not a shipping clip or acceptance claim. */
export function proposedEnvelope(stage: number, observedPhase: number, observedClock: number, attack: number) {
  const smooth = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
  if (stage !== 1 && stage !== 3) return { tell: 0, cut: 0 };
  // Authoritative live windup wins over stale idle/recovery/active observations.
  if (attack >= 0) {
    const rise = smooth(attack / .3), sweep = smooth((attack - .45) / .5);
    return { tell: rise * (1 - sweep), cut: sweep };
  }
  // cancelAttack runs at authoritative active, before the next observed phase.
  if (observedPhase === 1 || observedPhase === 2) return { tell: 0, cut: 1 };
  if (observedPhase === 3) return { tell: 0, cut: 1 - smooth(observedClock / (stage === 1 ? .12 : 1.1)) };
  return { tell: 0, cut: 0 };
}
