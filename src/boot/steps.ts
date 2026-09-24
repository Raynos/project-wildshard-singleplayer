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
export interface StepInfo { readonly label: string; readonly weight: number }
const BASE_INFO = Object.fromEntries(STEP_ROWS.map(([key, label, weight]) => [key, { label, weight }])) as Record<BootStep, StepInfo>;
/** The step table as this shard shows it: the rows above, with its own nouns and weights over them (`useShardSteps`). */
export const STEP_INFO: Record<BootStep, StepInfo> = { ...BASE_INFO };
/** The steps in declared order. */
export const BOOT_STEPS = STEP_ROWS.map((row) => row[0]) as readonly BootStep[];

/**
 * A shard's own loading-screen nouns and weights, over the shared steps (the step KEYS are the boot's; what each one
 * builds differs per shard). Nalati builds its whole world in `props` (wireNalati) and has no cabins, forest or
 * undergrowth to speak of; the weights are its measured wall-ms shape (phone tier, 2026-09-23: props 860, sky 245,
 * shaders 220, terrain 175, grass 40, first frame 40 ms, the rest < 15), the first-run bar's pace until this device has
 * timed a load of its own. `trees` is the byte label of the `cards` step's download.
 */
const SHARD_STEPS: Readonly<Record<string, Partial<Record<BootStep | 'trees', Partial<StepInfo>>>>> = {
  'nalati-grasslands': {
    renderer: { weight: 0.3 },
    sky: { label: 'Sky · the painted panorama', weight: 2.5 },
    terrain: { label: 'Steppe · the bowl · the snow ring', weight: 1.8 },
    cards: { label: 'Spruce cards', weight: 0.1 },
    forest: { label: 'Lone spruces', weight: 0.15 },
    edge: { label: 'Kunes river · cloud sea · horizon', weight: 0.15 },
    grass: { label: 'Grass rings · painted clumps', weight: 0.5 },
    cabins: { label: 'Yurts', weight: 0.05 },
    props: { label: 'Camp · kurgans · herds · the Storm Titan', weight: 8.5 },
    animals: { label: 'Wolves · horses · sheep', weight: 0.1 },
    weapon: { label: 'Recurve bow · HUD', weight: 0.05 },
    shaders: { weight: 2.2 },
    firstFrame: { weight: 0.5 },
    trees: { label: 'spruce bark' },
  },
};

let shard: string | null = null;
/**
 * The active shard's nouns + weights over the table (main.ts, before the boot plan is made). A shard without its own
 * rows keeps the shared table exactly, and its load timings stay under the shared key (`shardTimingKey`).
 */
export function useShardSteps(slug: string): void {
  const o = SHARD_STEPS[slug];
  shard = o ? slug : null;
  for (const k of BOOT_STEPS) STEP_INFO[k] = { label: o?.[k]?.label ?? BASE_INFO[k].label, weight: o?.[k]?.weight ?? BASE_INFO[k].weight };
}
/** '' for the shared table, else `:<slug>` — the timing store keys a shard with its own steps separately */
export const shardTimingKey = (): string => (shard ? `:${shard}` : '');

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
// a shard may name its own tree bytes (SHARD_STEPS: Nalati's spruce / props)
export const byteLabel = (key: ByteKey): string => (key === 'trees' && shard ? SHARD_STEPS[shard]?.trees?.label : undefined) ?? LABELS[key] ?? STEP_INFO[closedBy(key)].label.toLowerCase();
