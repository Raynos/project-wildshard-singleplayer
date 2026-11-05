import type { Vector3 } from 'three';
import type { PlayerSim } from '../sim/playerSim';

/** What a fight's contenders ask of its brain: is it on, and the whole party's return to the checkpoint. */
interface ContendedBoss {
  readonly engaged: boolean;
  readonly script: { readonly respawnPoint: () => { pos: Vector3; yaw: number } };
  readonly onPlayerDeath: () => boolean;
}

/**
 * The players one boss fight deals with. `BossBrain` watches one point and sends "the player" back on a death; in a room
 * that point is whoever stands past the threshold, a player who falls goes back alone while anyone still stands inside,
 * and the fight resets only when nobody does. A lone player falls straight through to the brain's own death.
 */
export class BossContenders {
  private readonly fallen = new Set<string>();
  private returning: PlayerSim | null = null;
  private readonly players: ReadonlyMap<string, PlayerSim>;
  private readonly inArena: (point: Vector3) => boolean;
  private readonly place: (player: PlayerSim, position: Vector3, yaw: number) => void;
  /** The point `BossBrain` watches, live. */
  readonly player: { readonly position: Vector3 };
  constructor(players: ReadonlyMap<string, PlayerSim>, inArena: (point: Vector3) => boolean, place: (player: PlayerSim, position: Vector3, yaw: number) => void) {
    this.players = players; this.inArena = inArena; this.place = place;
    const contender = (): PlayerSim => this.contender();
    this.player = { get position() { return contender().position; } };
  }
  private first(): PlayerSim {
    const first = this.players.values().next();
    if (first.done === true) throw new Error('Simulation host has no player');
    return first.value;
  }
  private contender(): PlayerSim {
    if (this.players.size > 1) for (const player of this.players.values()) if (this.inArena(player.position)) return player;
    return this.first();
  }
  /** The brain's respawn: the one who fell, or everyone on a reset. */
  readonly respawn = (position: Vector3, yaw: number): void => {
    if (this.returning !== null) { this.place(this.returning, position, yaw); return; }
    for (const player of this.players.values()) this.place(player, position, yaw);
  };
  /** Every player turns with the intro's camera. */
  readonly faceToward = (target: Vector3): void => {
    for (const player of this.players.values()) player.yaw = Math.atan2(player.position.x - target.x, player.position.z - target.z);
  };
  /** A room's death: true when this fight owned it. A lone player's death belongs to the brain. */
  fell(id: string, boss: ContendedBoss): boolean {
    const player = this.players.get(id);
    if (!boss.engaged || player === undefined) return false;
    this.fallen.add(id);
    for (const other of this.players.values()) if (!this.fallen.has(other.id) && this.inArena(other.position)) {
      const { pos, yaw } = boss.script.respawnPoint();
      this.returning = player;
      try { this.respawn(pos, yaw); } finally { this.returning = null; }
      return true;
    }
    this.fallen.clear();
    return boss.onPlayerDeath();
  }
  /** Who is out until the next reset, for a continuation; empty in any one-player fight. */
  get out(): readonly string[] { return [...this.fallen]; }
  restoreOut(ids: readonly string[]): void { this.fallen.clear(); for (const id of ids) this.fallen.add(id); }
}
