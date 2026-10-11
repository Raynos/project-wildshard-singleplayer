import { parseMovers } from '@wildshard/format/movers';
import { type AnimationClip, InterpolateLinear, Object3D, PropertyBinding } from 'three';
import { lowerMoverMotion, MoverMotionSchema, type MoverMotion, type MoverTrack } from '@wildshard/format/moverMotion';
import * as v from 'valibot';

/** Typed numeric mover declarations: local collider primitives and admitted fixed-step scripts. */
export type MoverData = ReturnType<typeof parseMovers>;
/** Validate identity, primitive limits and numeric data before an author product constructs physics. */
export function movers(data: unknown): MoverData { return parseMovers(data); }

/** Motion options on a real three.js object, with explicit gameplay activation. */
export interface MoverOptions {
  clip?: AnimationClip;
  trigger: MoverMotion['trigger'];
  driver: MoverMotion['driver'];
  speed?: number;
}
/** An ordinary scene object with a stop clip and a fixed data-only mover policy. */
export class Mover extends Object3D {
  /** Actual authored body; its stable name binds the clip. */
  readonly body: Object3D;
  /** Options retained for build-time compilation. */
  readonly options: MoverOptions;
  constructor(body: Object3D, options: MoverOptions) {
    super(); this.body = body; this.options = options; this.name = body.name; this.add(body);
  }
  /** Read real clip keys; unrelated objects, unsupported interpolation or incomplete stops refuse. */
  toMotionData(): MoverMotion {
    const clip = this.options.clip;
    let track: MoverTrack | undefined;
    if (clip !== undefined) {
      if (clip.tracks.length !== 1) throw new Error('Mover stop clip requires exactly one transform channel');
      const channel = clip.tracks[0]; if (channel === undefined) throw new Error('Missing mover clip channel');
      const binding = PropertyBinding.parseTrackName(channel.name);
      if (channel.getInterpolation() !== InterpolateLinear || channel.times.length !== 2 || channel.times[0] !== 0 || channel.times[1] !== clip.duration || Boolean(binding.objectName) || Boolean(binding.propertyIndex) || !['', '.', this.body.name, this.body.uuid].includes(binding.nodeName)) throw new Error('Mover clip must linearly bind both stops on its own body');
      const times: [number, number] = [channel.times[0], channel.times[1]];
      const common = { clip: clip.name, duration: clip.duration, loop: 'once' as const, speed: this.options.speed ?? 1, times };
      if (binding.propertyName === 'position' && channel.getValueSize() === 3) {
        const [x0, y0, z0, x1, y1, z1] = channel.values;
        if (x0 === undefined || y0 === undefined || z0 === undefined || x1 === undefined || y1 === undefined || z1 === undefined) throw new Error('Missing position stop');
        track = { ...common, position: [[x0, y0, z0], [x1, y1, z1]] };
      } else if (binding.propertyName === 'quaternion' && channel.getValueSize() === 4) {
        const [x0, y0, z0, w0, x1, y1, z1, w1] = channel.values;
        if (x0 === undefined || y0 === undefined || z0 === undefined || w0 === undefined || x1 === undefined || y1 === undefined || z1 === undefined || w1 === undefined) throw new Error('Missing quaternion stop');
        track = { ...common, quaternion: [[x0, y0, z0, w0], [x1, y1, z1, w1]] };
      } else throw new Error('Mover clips animate position or quaternion');
    }
    return v.parse(MoverMotionSchema, { ...(track === undefined ? {} : { track }), trigger: this.options.trigger, driver: this.options.driver });
  }
  /** Bind authored motion to a numeric collider/rest row while retaining the fixed guest continuation ABI. */
  toMoverData(rest: Omit<MoverData[number], 'module' | 'input' | 'track' | 'trigger' | 'driver'>): MoverData[number] {
    const motion = this.toMotionData(), compiled = lowerMoverMotion(motion, rest), row = { ...rest, ...compiled, ...motion };
    parseMovers([row]); return row;
  }
}
