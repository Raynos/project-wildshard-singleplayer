/** An authored clip's duration in seconds and the normalized phase of its gameplay contact. */
export interface AuthoredClipTiming { readonly duration: number; readonly hitPhase: number }

/** Contact time in the caller's simulation clock; independent of rendering or a view's animation mixer. */
export function clipHitTime(clip: AuthoredClipTiming): number {
  if (!Number.isFinite(clip.duration) || clip.duration <= 0 || !Number.isFinite(clip.hitPhase)
    || clip.hitPhase < 0 || clip.hitPhase > 1) throw new RangeError('Invalid authored clip timing');
  return clip.duration * clip.hitPhase;
}

/** The first caller tick at/after the authored contact. The caller owns its one-shot transition and saved clock. */
export function clipHitReached(elapsed: number, clip: AuthoredClipTiming): boolean {
  return elapsed >= clipHitTime(clip);
}
