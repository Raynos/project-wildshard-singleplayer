/** Shard-wide decision events; the trusted quest recipe retains lights, captions, inventory and the sky renderer. */
export type PineClockEvent = 'night.consume' | 'night.start' | 'dawn.start' | 'dawn.sunrise' | 'dawn.lanterns' | 'dawn.caption' | 'dawn.finish';
/** Live facts and native presentation callbacks, without ownership of engine services. */
export interface PineClockPorts {
  seen: () => boolean; hasClock: () => boolean; night: () => number; publish: (event: PineClockEvent, value: number) => void;
}
/** Actual shipping night/dawn decisions, extracted unchanged in SF24 for the same-engine replay oracle. */
export class LegacyPineClock {
  private dawnT = -1;
  private readonly ports: PineClockPorts;
  constructor(ports: PineClockPorts) { this.ports = ports; }
  night(): void {
    this.ports.publish('night.consume', 0);
    if (this.ports.night() < 0.5 && this.ports.hasClock()) this.ports.publish('night.start', 6);
  }
  dawn(): void {
    if (this.dawnT >= 0 || this.ports.seen()) return;
    this.dawnT = 0; this.ports.publish('dawn.start', 0);
  }
  tick(dt: number): void {
    if (this.dawnT < 0) return;
    const was = this.dawnT; this.dawnT += dt;
    const at = (s: number): boolean => was < s && this.dawnT >= s;
    if (at(2.5) && this.ports.hasClock()) this.ports.publish('dawn.sunrise', 7);
    if (at(4)) this.ports.publish('dawn.lanterns', 0);
    if (at(5)) this.ports.publish('dawn.caption', 0);
    if (at(12)) { this.ports.publish('dawn.finish', 0); this.dawnT = -1; }
  }
  /** the dawn's clock (s since it started; −1: none running), the headless quest's continuation */
  save(): number { return this.dawnT; }
  load(dawnT: number): void { this.dawnT = dawnT; }
}
