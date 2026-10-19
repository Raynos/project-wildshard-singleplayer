/** Strict source gate. Characterizing a failed attempt never changes these limits. */
export function motionSourceGate(motion, stance) {
  const envelope = motion?.envelope, feet = Object.values(stance?.perFoot ?? {});
  return Number.isFinite(envelope?.minimum) && envelope.minimum >= -1e-6
    && Number.isFinite(envelope?.maxStep) && envelope.maxStep <= .10
    && feet.length === 4 && feet.every(foot => Number.isFinite(foot.footRootRatio) && foot.footRootRatio <= .20
      && Number.isFinite(foot.medianFootSpeed) && foot.medianFootSpeed <= .20);
}
export function requireMotionSourceGate(motion, stance) {
  if (!motionSourceGate(motion, stance)) throw new Error('Rejected Mantis source motion; no product admission');
}
