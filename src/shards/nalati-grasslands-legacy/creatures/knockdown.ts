/** s a knock-down's shove lasts: the player's dash along the blow. */
export const KNOCKDOWN_TIME = 0.28;
/** m/s of a strength-1 knock-down; the strength is clamped to 0.4‥1.5 of it. */
const KNOCKDOWN_SPEED = 7;

/**
 * Bowled over (the stallion's charge, a stampede, Argymaq's knock: `WildEnv.onKnockdown`): the player's dash velocity along
 * the blow, into `out`, for a dash of KNOCKDOWN_TIME. The page (runtime/state.ts, `Player.dash`) and a renderer-free host
 * (runtime/headlessCreatures.ts, `SimHost.dashPlayer`) run this one rule.
 */
export function knockdownDash(dirX: number, dirZ: number, strength: number, out: { x: number; z: number }): void {
  const l = Math.hypot(dirX, dirZ) || 1, v = KNOCKDOWN_SPEED * Math.max(0.4, Math.min(1.5, strength));
  out.x = (dirX / l) * v; out.z = (dirZ / l) * v;
}
