import {controlFileHashes} from '../../src/format/admissionControl';
import {entryFileSteps} from '../../src/format/tierSelection';
import type {Shardfile} from '../../src/format/shardSchema';
import type {OutputIndex} from '../../src/format/outputIndex';
import {wholeGeometryInputs} from '../../src/game/shardfile/wholeInputs';

/** The same required, active entry selection for totals and read-ahead. Default (the Shardfile path every player gets):
 * today's entry set; streamed/late-only bodies and the other device's variants are not entry IO. `whole` (DL5, G872:
 * "no deferring level content past control"; read only with Debug > Level download > Runtime packs until a memory
 * reading backs it): the whole level on this tier, every byte its play can load, resident at control. */
export function entryReadSet(source: Shardfile, tier: 'phone' | 'desktop', index: Pick<OutputIndex, 'files' | 'sections' | 'schemas'>,
  sections: ReadonlyMap<string, unknown>, whole = false): ReadonlySet<string> {
  const required = controlFileHashes(source), steps = entryFileSteps(source, tier, {index, sections});
  let turn = steps.next(); while (turn.done !== true) turn = steps.next();
  const wanted = new Set([...index.sections, ...index.schemas].map(row => row.hash));
  // `turn.value` is what this tier streams after control today: still required, so the whole level keeps it.
  for (const file of index.files) if (required.has(file.hash) && (whole ? file.tier === undefined || file.tier === tier : !turn.value.has(file.hash))) wanted.add(file.hash);
  // `late` only schedules a library member after control (controlFileHashes leaves it out); the level still loads it
  // in play. Tile streaming loads every tile of the tier (every LOD) as the player moves; control requires none.
  const late = new Set((source.late ?? []).map(row => row.hash)), byHash = new Map(source.files.map(file => [file.hash, file]));
  const tileFiles = whole ? source.tiles.flatMap(tile => tile.files.map(ref => ref.replace(/^commons:/u, ''))) : [];
  const tierOf = new Map(index.files.map(file => [file.hash, file.tier])), seen = new Set<string>();
  const pending = whole ? [...source.library.filter(hash => late.has(hash)), ...tileFiles] : [];
  while (pending.length > 0) {
    const hash = pending.pop(); if (hash === undefined || seen.has(hash)) continue;
    seen.add(hash); pending.push(...byHash.get(hash)?.dependencies ?? []);
    const fileTier = tierOf.get(hash);
    if (tierOf.has(hash) && (fileTier === undefined || fileTier === tier)) wanted.add(hash);
  }
  const plan = sections.get('client/plan'), features: unknown = typeof plan === 'object' && plan !== null ? Reflect.get(plan, 'features') : undefined;
  // This host starts its complete native intake before construction. These
  // are actual mandatory reads, even when a tile is outside the spawn view.
  if (Array.isArray(features) && features.some((row: unknown) => typeof row === 'object' && row !== null
    && Reflect.get(row, 'kind') === 'world.assembly' && typeof Reflect.get(row, 'library') === 'string')) {
    for (const hash of wholeGeometryInputs(source.props, true)) wanted.add(hash);
  }
  return wanted;
}
