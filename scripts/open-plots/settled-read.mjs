import {domeResidencySettled} from '../dome-cameras.mjs';

/** Capture the actual ready grid and its dependent values in one browser task.
 * A boolean wait followed by another CDP read races new background admission.
 * @param {string} readerSource Trusted local synchronous reader (argument, grid).
 * @param {unknown} argument */
export function settledDomeReadExpression(readerSource, argument) {
  const encoded = JSON.stringify(argument);
  if (encoded === undefined) throw new Error('Capture read requires a JSON argument');
  return `(argument => {
    const grid = window.__wildshard.shard.grid.state();
    if (!(${domeResidencySettled.toString()})(grid)) return false;
    return (${readerSource})(argument, grid);
  })(${encoded})`;
}
