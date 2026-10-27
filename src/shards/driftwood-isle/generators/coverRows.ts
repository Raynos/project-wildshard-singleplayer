import authored from '../data/groundCover.json' with { type: 'json' };

function pair(values: readonly number[]): [number, number] {
  const [lo, hi] = values;
  if (values.length !== 2 || lo === undefined || hi === undefined || !Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error('Authored cover requires finite pairs');
  return [lo, hi];
}
type CoverKind = 'tuft' | 'fern' | 'hibiscus' | 'daisy' | 'pebble' | 'shells' | 'starfish' | 'bush';
function kindName(value: string): CoverKind {
  if (value === 'tuft' || value === 'fern' || value === 'hibiscus' || value === 'daisy'
    || value === 'pebble' || value === 'shells' || value === 'starfish' || value === 'bush') return value;
  throw new Error('Unknown authored cover kind');
}
function coverKind(row: (typeof authored.GROUND_COVER.kinds)[number]) {
  const { far, ...rest } = row;
  return { ...rest, name: kindName(row.name), reach: pair(row.reach), scale: pair(row.scale),
    ...(far === undefined ? {} : { far: { ...far, reach: pair(far.reach) } }) };
}
if (authored.GROUND_COVER.look !== 'driftwood-cover') throw new Error('Unknown authored cover look');

/** The unchanged authored cover policy with only its consumed literals/pairs checked. */
export const GROUND_COVER: Omit<typeof authored.GROUND_COVER, 'look' | 'kinds'> & { look: 'driftwood-cover'; kinds: ReturnType<typeof coverKind>[] } = {
  ...authored.GROUND_COVER, look: authored.GROUND_COVER.look, kinds: authored.GROUND_COVER.kinds.map(coverKind),
};
/** Original material order for source compilation. */
export const COVER_LOOKS: typeof authored.COVER_LOOKS = authored.COVER_LOOKS;
