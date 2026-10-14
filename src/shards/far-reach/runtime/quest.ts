import type { SimHost } from '@wildshard/engine/sim';
import { FLAGS } from '../quest/flags';

/** The winch's permission bits, as the browser hands its mover (runtime/index.ts): the roost quiet 1, the vanes turning 2. */
export function skyWinchPermission(flags: Pick<SimHost['flags'], 'has'>): number {
  return Number(flags.has(FLAGS.roost)) + Number(flags.has(FLAGS.vanes)) * 2;
}


