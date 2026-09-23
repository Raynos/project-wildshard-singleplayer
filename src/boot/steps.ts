/**
 * The boot plan's vocabulary — the ONE place the loading screen's steps, labels, weights and
 * byte sources are declared. Ported from game-demos/trials-gauntlet-demo `src/boot/steps.ts`
 * (project/archive/2026-09-22-load-perf.md §1b). Everything the loader shows is derived from these tables by
 * `createBootPlan` (`./plan.ts`); nothing downstream parses a label or sums a constant.
 * A step declared here and not run by `main.ts` is a compile error (`done` only exists on the
 * exhausted plan type).
 */
const STEP_ROWS = [
  ['renderer', 'Renderer', 1],
  ['sky', 'Sky · HDRI → PMREM', 1],
  ['terrain', 'Terrain · heightfield + splat', 2],
  ['cards', 'Pine branch cards', 1],
  ['forest', 'Forest', 2],
  ['physics', 'Physics · Rapier · navmesh', 1],
  ['edge', 'Chunk edge · water · horizon', 1],
  ['grass', 'Grass · ferns · litter', 2],
  ['cabins', 'Cabins', 2],
  ['props', 'Props', 1],
  ['animals', 'Herds', 1],
  ['weapon', 'Crossbow · HUD', 1],
  // project/archive/2026-09-23-preload-offline.md: the title / explore art and the lazy UI code (before the title builds its deck)
  ['menu', 'Title art · explore', 1],
  ['shaders', 'Shaders', 3],
  ['firstFrame', 'First frame', 3],
  // last, so the shaders compile while it downloads: every audio file (all styles, all sets), the selected music style +
  // sound-effect set decoded as their bytes land — nothing is fetched after the bar (project/archive/2026-09-23-preload-offline.md)
  ['audio', 'Audio · music + sound effects', 3],
] as const satisfies readonly (readonly [string, string, number])[];
export type BootStep = (typeof STEP_ROWS)[number][0];
export const STEP_INFO = Object.fromEntries(STEP_ROWS.map(([key, label, weight]) => [key, { label, weight }])) as Record<BootStep, { readonly label: string; readonly weight: number }>;
/** The steps in declared order. */
export const BOOT_STEPS = STEP_ROWS.map((row) => row[0]) as readonly BootStep[];

/**
 * DOWNLOAD byte sources: the bytes boot awaits, each reported by the reader that reads them and
 * CLOSED (read := total) by the step whose completion proves they were consumed. A source is in
 * the number because it is in this table, and complete because its step is — `done()` reads 1
 * by arithmetic, never by reclassification.
 */
export const BYTE_SOURCES = ['sky', 'baked', 'terrain', 'trees', 'physics', 'cabins', 'props', 'art', 'music', 'sfx'] as const;
export type ByteKey = (typeof BYTE_SOURCES)[number];
const CLOSED_BY: Record<ByteKey, BootStep> = { sky: 'sky', baked: 'sky', terrain: 'terrain', trees: 'cards', physics: 'physics', cabins: 'cabins', props: 'props', art: 'menu', music: 'audio', sfx: 'audio' };
export const closedBy = (key: ByteKey): BootStep => CLOSED_BY[key];
const LABELS: Partial<Record<ByteKey, string>> = { trees: 'pine bark · twigs', baked: 'baked textures', art: 'title art', music: 'music · every style', sfx: 'sound effects · every set' };
export const byteLabel = (key: ByteKey): string => LABELS[key] ?? STEP_INFO[closedBy(key)].label.toLowerCase();
