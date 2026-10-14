import { Scope } from '../app/scope';
import type { Audio } from './Audio';
import type { AudioData } from '@wildshard/format/audio';
import { tap, ambientTick } from '../core/harnessTap';
import { Rng } from '../core/rng';

declare module '../core/rng' { interface RngStreams { audio: true } }

const fallback = new Rng(0);
let draw: () => number = () => fallback.next();
export function bindAudioRandom(random: () => number): void { draw = random; }
export const audioRandom = (): number => draw();

/** Player yaw's right vector, with the caller's original spread, distance metric and near cut (centred within `near` m). */
export function panFromYaw(dx: number, dz: number, yaw: number, spread = 0.8, distance = Math.hypot(dx, dz), near = 0.5): number {
  return distance > near ? Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance)) * spread : 0;
}

/** Start a loop at a cosmetic offset inside its authored loop region. */
export function loopAt(source: AudioBufferSourceNode, buffer: AudioBuffer,
  loop?: { loopStart: number; loopEnd: number },
  random: () => number = audioRandom, time = 0): void {
  const bounds = loop ?? { loopStart: 0, loopEnd: buffer.duration };
  source.buffer = buffer; source.loop = true;
  source.loopStart = bounds.loopStart; source.loopEnd = bounds.loopEnd;
  source.start(time, bounds.loopStart + random() * (bounds.loopEnd - bounds.loopStart));
}

/** Shared wind bands and gust envelopes; each declared preset retains its scope,
 * tap IDs, band order, random draws and native AudioContext scheduling.
 * Subclasses lend only the original independent bird/wave schedulers.
 */
export class WindGustBed {
  private scope: Scope | undefined;
  private gains: GainNode[] = [];
  private readonly gust: NonNullable<NonNullable<AudioData['ambience']>['gust']>;
  protected readonly audio: Audio;
  private readonly rows: NonNullable<AudioData['ambience']>;
  constructor(audio: Audio, rows: NonNullable<AudioData['ambience']>) {
    this.audio = audio; this.rows = rows;
    if (rows.gust === undefined || rows.winds.length < 2) throw new Error('Missing declared wind/gust preset');
    this.gust = rows.gust;
  }
  stop(): void { this.scope?.dispose(); this.scope = undefined; this.gains = []; }
  start(): void {
    if (this.gust.scopeFirst) this.scope = new Scope(this.gust.scope);
    tap.sound?.(this.gust.startTap);
    this.gains = this.rows.winds.map(row => this.audio.mkWind(row.frequency,row.q,row.pan,row.rate,row.gain,row.cutoff));
    this.scheduleGust();
  }
  /** Preserve lazy timer ownership or the preset's explicitly started scope. */
  protected queue(milliseconds: number, run: () => void): void {
    if (!this.gust.scopeFirst) this.scope ??= new Scope(this.gust.scope);
    this.scope?.timeout(milliseconds,run);
  }
  private sample(range: readonly [number,number]): number { return range[0] + audioRandom() * (range[1]-range[0]); }
  private scheduleGust(): void {
    const wait = this.sample(this.gust.wait) * this.gust.gentle;
    this.queue(wait*1000,()=>{ ambientTick(this.gust.tap,()=>{
      const first = this.gains[0], second = this.gains[1];
      if (this.audio.ambientOn && first !== undefined && second !== undefined) {
        const time = this.audio.ctx.currentTime, rise = this.sample(this.gust.rise), fall = this.sample(this.gust.fall), amount = 1 + this.sample(this.gust.amount)/this.gust.gentle;
        for (const [index,gain] of [first,second].entries()) {
          const row = this.rows.winds[index]; if (row === undefined) throw new Error('Missing gust band');
          gain.gain.cancelScheduledValues(time); gain.gain.setValueAtTime(gain.gain.value,time);
          gain.gain.linearRampToValueAtTime(row.gain*amount,time+rise); gain.gain.linearRampToValueAtTime(row.gain,time+rise+fall);
        }
      }
      this.scheduleGust();
    }); });
  }
}
