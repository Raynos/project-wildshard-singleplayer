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
  ['edge', 'Chunk edge · water · horizon', 1],
  ['grass', 'Grass · ferns · litter', 2],
  ['cabins', 'Cabins', 2],
  ['props', 'Props', 1],
  ['animals', 'Herds', 1],
  ['weapon', 'Crossbow · HUD', 1],
  ['shaders', 'Shaders', 3],
  ['firstFrame', 'First frame', 3],
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
export const BYTE_SOURCES = ['sky', 'baked', 'terrain', 'trees', 'cabins', 'props'] as const;
export type ByteKey = (typeof BYTE_SOURCES)[number];
const CLOSED_BY: Record<ByteKey, BootStep> = { sky: 'sky', baked: 'sky', terrain: 'terrain', trees: 'cards', cabins: 'cabins', props: 'props' };
export const closedBy = (key: ByteKey): BootStep => CLOSED_BY[key];
export const byteLabel = (key: ByteKey): string => key === 'trees' ? 'pine bark · twigs' : key === 'baked' ? 'baked textures' : STEP_INFO[closedBy(key)].label.toLowerCase();
