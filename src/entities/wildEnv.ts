import type * as THREE from 'three';

/**
 * wildEnv — the one shared view of the world the Nalati creature AIs read (wolf packs `Pack.ts`, horse herds `Herd.ts`,
 * the sheep flock `Flock.ts`). `Wildlife.ts` refreshes the player fields every frame; the grass / wind / clock fields
 * are hooks the other rows plug in (defaults keep every AI working without them):
 *
 *   wildEnv.grassHeightAt = (x, z) => grass.grassHeightAt(x, z)     B1 grass-agent (default: a 0.55 m steppe everywhere)
 *   wildEnv.trample       = (x, z, r, s, vx, vz) => trample.push(…)    B1 GrassTrample (default: nothing) — Wildlife.update pushes every
 *                                                                        moving wolf / horse / dog each frame (the live movers + the map)
 *   wildEnv.wind          = { x, z, strength }                        B1 Wind: the direction the air moves TOWARD (unit), 0..1
 *   wildEnv.light         = 1 day · 0.7 dusk · 0.4 night · 0.6 storm  B10 clock
 *   wildEnv.onKnockdown   = (dirX, dirZ, strength) => …               the player was bowled over (stallion charge, stampede)
 *   wildEnv.onEvent       = (name, x, z) => …                          'howl' 'stampede' 'pack-break' 'pack-driven-off' 'stallion-display' …
 *
 * `playerVisibility()` is the stealth sight model of `docs/design/nalati/stealth-and-storms.md` (cover from the grass
 * at the player and along the line to the observer, motion, light): the sight range an animal gets is `range × V`.
 * B9 (crouch + stealth) may replace it; every creature asks through this one function.
 */
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const SCREEN_STEPS = [1.5, 3, 5] as const;

export interface WildEnv {
  grassHeightAt: (x: number, z: number) => number;
  trample: (x: number, z: number, radius: number, strength: number, vx: number, vz: number) => void;
  wind: { x: number; z: number; strength: number };
  /** the player's horizontal look direction (unit x, z) — the view cone the wolves stay out of */
  playerFwdX: number; playerFwdZ: number;
  playerCrouched: boolean;
  /** true while riding (B7): two attack tokens, the pack runs with the horse */
  playerMounted: boolean;
  /** 0..1 — the alpha joins the lunges when the player is hurt (< 0.6) */
  playerHealth01: number;
  /** seconds (performance clock) of the player's last shot — shooting reveals you for 1 s */
  lastShotT: number;
  light: number;
  storm: boolean;
  onKnockdown?: ((dirX: number, dirZ: number, strength: number) => void) | undefined;
  onEvent?: ((name: string, x: number, z: number) => void) | undefined;
}

export const wildEnv: WildEnv = {
  grassHeightAt: () => 0.55,
  trample: () => undefined,
  wind: { x: -0.8, z: 0.6, strength: 0.5 },
  playerFwdX: 0, playerFwdZ: -1,
  playerCrouched: false, playerMounted: false, playerHealth01: 1, lastShotT: -1e9,
  light: 1, storm: false,
};

/**
 * How much of the player an observer at (ox, oz) can see, 0..1 (the stealth doc's V): grass cover at the player and
 * along the sight line, × motion (still 0.3 · creep 0.7 · walk 1 · sprint 1.5 · just shot 1.5), × light.
 */
export function playerVisibility(ox: number, oz: number, player: THREE.Vector3, playerSpeed: number, now: number): number {
  const g = wildEnv.grassHeightAt(player.x, player.z);
  const h = wildEnv.playerCrouched ? 1.05 : 1.75;
  const cover = clamp01((g - 0.15) / (h - 0.15));
  // the screen: grass between you and the observer, 1.5 / 3 / 5 m out toward it
  let dx = ox - player.x, dz = oz - player.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  let screen = 0;
  for (const s of SCREEN_STEPS) {
    if (s > d) break;
    screen += clamp01((wildEnv.grassHeightAt(player.x + dx * s, player.z + dz * s) - 0.15) / (h - 0.15)) / 3;
  }
  const motion = now - wildEnv.lastShotT < 1 ? 1.5 : playerSpeed < 0.4 ? 0.3 : playerSpeed <= 2.6 ? 0.7 : playerSpeed < 5.2 ? 1 : 1.5;
  return (1 - 0.9 * Math.max(cover, 0.7 * screen)) * motion * wildEnv.light;
}

/** true when (ox, oz) is downwind of the player within ±35° — the smell sense (wolves, the stallion) */
export function downwindOf(ox: number, oz: number, player: THREE.Vector3): boolean {
  const w = wildEnv.wind;
  const dx = ox - player.x, dz = oz - player.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3 || w.strength < 0.05) return false;
  return (dx * w.x + dz * w.z) / d > 0.82;   // cos 35°
}

/** hearing radius by the player's ground speed (still / crouch / walk / sprint), × 1.25 moving in tall grass, × 0.5 in a storm */
export function hearingRadius(r: [number, number, number, number], player: THREE.Vector3, playerSpeed: number): number {
  const base = playerSpeed < 0.4 ? r[0] : playerSpeed <= 2.6 ? r[1] : playerSpeed < 5.2 ? r[2] : r[3];
  const rustle = playerSpeed > 0.4 && wildEnv.grassHeightAt(player.x, player.z) >= 0.7 ? 1.25 : 1;
  return base * rustle * (wildEnv.storm ? 0.5 : 1);
}

/** shortest signed angle a − b, radians */
export const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
