import { Rng } from '../core/rng';

declare module '../core/rng' { interface RngStreams { audio: true } }

const fallback = new Rng(0);
let draw: () => number = () => fallback.next();
export function bindAudioRandom(random: () => number): void { draw = random; }
export const audioRandom = (): number => draw();

/** Player yaw's right vector, with the caller's original spread and distance metric. */
export function panFromYaw(dx: number, dz: number, yaw: number, spread = 0.8, distance = Math.hypot(dx, dz)): number {
  return distance > 0.5 ? Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance)) * spread : 0;
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
