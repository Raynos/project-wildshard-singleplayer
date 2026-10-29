import {controlFileHashes} from '../../src/format/admissionControl';
import {entryFileSteps} from '../../src/format/tierSelection';
import type {Shardfile} from '../../src/format/shardSchema';
import type {OutputIndex} from '../../src/format/outputIndex';

/** The same required, active entry selection for totals and read-ahead.
 * Streamed/late-only bodies and the other device's variants are not entry IO. */
export function entryReadSet(source: Shardfile, tier: 'phone' | 'desktop', index: OutputIndex,
  sections: ReadonlyMap<string, unknown>): ReadonlySet<string> {
  const required = controlFileHashes(source), steps = entryFileSteps(source, tier, {index, sections});
  let turn = steps.next(); while (turn.done !== true) turn = steps.next();
  const wanted = new Set([...index.sections, ...index.schemas].map(row => row.hash));
  for (const file of index.files) if (required.has(file.hash) && !turn.value.has(file.hash)) wanted.add(file.hash);
  return wanted;
}
