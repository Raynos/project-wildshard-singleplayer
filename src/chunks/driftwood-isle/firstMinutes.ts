import type { FirstHints } from '../../ui/FirstHints';
import { lockOn } from '../../player/AimTargets';

/**
 * Driftwood's first three minutes (E308, DRIFTWOOD-TOP10 row 5): WHEN each first-time control hint matters on the island.
 * The hints themselves — the label + pulsing ring on the touch control, what counts as using it, shown once — are the
 * shared src/ui/FirstHints.ts; this only feeds it the island's six triggers, highest priority first:
 *
 *   DODGE   an enemy within 10 m winds up (the practice crab raising its claws) — for 2.5 s after the wind-up starts
 *   ATTACK  a living enemy within 6 m (the practice crab on the path at the pier's foot is the first one you meet)
 *   LOCK    ATTACK is known and something is lockable (the LOCK disc is up)
 *   TALK    the USE band reads "Talk to …" (Wendell at the hut) — "TAP TO TALK"
 *   MOVE    from the first frame in the world (half way down the pier) until you have walked 3 m
 *   JUMP    MOVE is known, 12 m walked, and no enemy within 15 m: the rest of the pier walk
 *
 *   const tick = installFirstMinutes({ hints, animals: () => animals.animals, player, onWindup: (fn) => { …chain animals.onWindup… }, prompt: () => … });
 *   game.onUpdate((dt) => { tick(dt); hints.update(dt); });
 */

interface Body { readonly position: { x: number; z: number }; readonly alive: boolean; readonly hidden: boolean; readonly kind: string }

/** the island's fighters — what ATTACK / DODGE are about (not the gull) */
const HOSTILE: ReadonlySet<string> = new Set(['crab', 'boar', 'bear', 'monkey', 'sailor']);
const ATTACK_R = 6, WINDUP_R = 10, CALM_R = 15, DODGE_FOR = 2.5, JUMP_AFTER = 12;
/** s between scans of the animals for the nearest fighter */
const SCAN_EVERY = 0.2;

export interface FirstMinutesDeps {
  hints: FirstHints;
  /** the shard's animals (AnimalManager.animals) */
  animals: () => readonly Body[];
  /** the player's feet */
  player: { readonly position: { x: number; z: number } };
  /** hook the manager's wind-up signal (AnimalManager.onWindup, chained) */
  onWindup: (fn: (a: Body) => void) => void;
  /** the HUD's interact prompt text while it shows ('' when none) */
  prompt: () => string;
}

/** feeds Driftwood's triggers; returns the per-frame tick (the nearest-fighter scan and the wind-up clock) */
export function installFirstMinutes(d: FirstMinutesDeps): (dt: number) => void {
  let nearest = Infinity, scanT = 0, windupT = Infinity;
  d.onWindup((a) => {
    const p = d.player.position;
    if (HOSTILE.has(a.kind) && Math.hypot(a.position.x - p.x, a.position.z - p.z) < WINDUP_R) windupT = 0;
  });
  d.hints.feed([
    { control: 'dodge', when: () => windupT < DODGE_FOR },
    { control: 'attack', when: () => nearest < ATTACK_R },
    { control: 'lock', when: () => d.hints.done('attack') && lockOn.state === 'available' },
    { control: 'use', when: () => d.prompt().includes('Talk to'), touch: 'Tap to talk', desk: 'E to talk' },
    { control: 'move', when: () => true },
    { control: 'jump', when: () => d.hints.done('move') && d.hints.distance >= JUMP_AFTER && nearest > CALM_R },
  ]);
  return (dt) => {
    windupT += dt;
    scanT -= dt;
    if (scanT > 0) return;
    scanT = SCAN_EVERY;
    const p = d.player.position;
    nearest = Infinity;
    for (const a of d.animals()) {
      if (!a.alive || a.hidden || !HOSTILE.has(a.kind)) continue;
      nearest = Math.min(nearest, Math.hypot(a.position.x - p.x, a.position.z - p.z));
    }
  };
}
