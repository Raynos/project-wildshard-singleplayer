/** Native control/rig recipes remain in G51; these ports expose their live hunt observations without owning them. */
export interface RaidClockPorts {
  raiding: boolean; pendingT: number; raidT: number;
  readonly present: boolean; readonly tracking: boolean; readonly broken: boolean; readonly preyAlive: boolean; readonly cracked: boolean;
  start: () => boolean; next: () => number; taken: () => void; drivenOff: () => void;
}
