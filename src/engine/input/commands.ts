/** Resolved device input for one fixed step. Replays supply these values directly. */
export interface PlayerCommand {
  readonly moveX: number;
  readonly moveY: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly crouch: boolean;
  readonly sprint: boolean;
  readonly jump: boolean;
  readonly dodge: boolean;
  readonly dive: boolean;
  readonly surface: boolean;
}
