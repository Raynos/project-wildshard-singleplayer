/** Shipping on-foot speed selection, shared by the page and an opted-in simulation driver.
 * Wade fraction is the page's already-resolved [0,1] depth; the caller owns sprint/crouch eligibility. */
export function walkingSpeed(crouching: boolean, sprinting: boolean, wadeFraction: number, moveScale: number, effectMoveScale: number): number {
  return (crouching ? 2.2 : sprinting ? 7.2 : 4.3) * (1 - 0.55 * wadeFraction) * moveScale * effectMoveScale;
}
/** The wade's share of the on-foot speed (walkingSpeed's depth term): a host with its own base speed scales it by this. */
export function wadeScale(wadeFraction: number): number { return 1 - 0.55 * wadeFraction; }
