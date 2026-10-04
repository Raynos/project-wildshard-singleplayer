/** World-space aim is command data, independent of camera shake, bob and render interpolation. */
export interface AimCommand {
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  readonly direction: { readonly x: number; readonly y: number; readonly z: number };
}

/** Weapon action plus its detached world-space aim, shared by live input and replay. */
export interface FightCommand {
  readonly aim: AimCommand;
  readonly action: 'attack' | 'reload';
}

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
  readonly aim: AimCommand;
}
