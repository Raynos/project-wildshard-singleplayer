export interface SpeciesFlight {
  altitude: number;
  /** Ground-relative by default; a missing/distant floor falls back to world altitude. */
  above?: 'ground' | 'world';
  climbRate: number; diveRate: number;
}
interface FlightPoint { x: number; y: number; z: number }
type FloorSampler = (x: number, z: number, fromY: number, maxDrop: number) => number | undefined;

/** Flight owns vertical motion, while the existing body still owns heading and speed. */
export class FlightMotion {
  private altitude: number;
  private sampleIn = 0;
  private floor: number | undefined;
  private smoothFloor: number | undefined;
  constructor(private readonly spec: SpeciesFlight) {
    if (!Number.isFinite(spec.altitude) || !Number.isFinite(spec.climbRate) || !Number.isFinite(spec.diveRate) || spec.climbRate <= 0 || spec.diveRate <= 0) throw new Error('Flight needs finite altitude and positive climb/dive rates');
    this.altitude = spec.altitude;
  }
  target(altitude: number): void {
    if (!Number.isFinite(altitude)) throw new Error('Flight altitude must be finite');
    this.altitude = altitude;
  }
  step(dt: number, position: FlightPoint, alive: boolean, sample: FloorSampler): void {
    if (this.spec.above !== 'world' || !alive) {
      this.sampleIn -= dt;
      if (this.sampleIn <= 0) {
        this.sampleIn = 0.2;
        const floor = sample(position.x, position.z, position.y + 1, 201);
        this.floor = floor !== undefined && Number.isFinite(floor) && position.y - floor <= 200 ? floor : undefined;
        this.smoothFloor ??= this.floor;
      }
      if (this.floor === undefined) this.smoothFloor = undefined;
      else if (this.smoothFloor !== undefined) this.smoothFloor += (this.floor - this.smoothFloor) * Math.min(1, dt * 8);
    }
    if (!alive) { position.y = Math.max(this.floor ?? -Infinity, position.y - this.spec.diveRate * dt); return; }
    const target = this.altitude + (this.spec.above === 'world' ? 0 : this.smoothFloor ?? 0);
    position.y += Math.max(-this.spec.diveRate * dt, Math.min(this.spec.climbRate * dt, target - position.y));
  }
}
