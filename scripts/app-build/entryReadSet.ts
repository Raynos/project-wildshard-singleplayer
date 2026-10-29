import {controlFileHashes} from '../../src/format/admissionControl';
import {entryFileSteps} from '../../src/format/tierSelection';
import type {Shardfile} from '../../src/format/shardSchema';
import type {OutputIndex} from '../../src/format/outputIndex';
import {wholeGeometryInputs} from '../../src/game/shardfile/wholeInputs';

/** The same required, active entry selection for totals and read-ahead.
 * Streamed/late-only bodies and the other device's variants are not entry IO. */
export function entryReadSet(source: Shardfile, tier: 'phone' | 'desktop', index: Pick<OutputIndex, 'files' | 'sections' | 'schemas'>,
  sections: ReadonlyMap<string, unknown>): ReadonlySet<string> {
  const required = controlFileHashes(source), steps = entryFileSteps(source, tier, {index, sections});
  let turn = steps.next(); while (turn.done !== true) turn = steps.next();
  const wanted = new Set([...index.sections, ...index.schemas].map(row => row.hash));
  for (const file of index.files) if (required.has(file.hash) && !turn.value.has(file.hash)) wanted.add(file.hash);
  const plan = sections.get('client/plan'), features: unknown = typeof plan === 'object' && plan !== null ? Reflect.get(plan, 'features') : undefined;
  // This host starts its complete native intake before construction. These
  // are actual mandatory reads, even when a tile is outside the spawn view.
  if (Array.isArray(features) && features.some((row: unknown) => typeof row === 'object' && row !== null
    && Reflect.get(row, 'kind') === 'world.assembly' && typeof Reflect.get(row, 'library') === 'string')) {
    for (const hash of wholeGeometryInputs(source.props, true)) wanted.add(hash);
  }
  return wanted;
}
