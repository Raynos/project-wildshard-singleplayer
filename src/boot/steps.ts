/**
 * The boot plan's vocabulary — the ONE place the loading screen's steps, labels, weights and
 * byte sources are declared. Ported from game-demos/trials-gauntlet-demo `src/boot/steps.ts`
 * (project/archive/2026-09-22-load-perf.md §1b). Everything the loader shows is derived from these tables by
 * `createBootPlan` (`./plan.ts`); nothing downstream parses a label or sums a constant.
 * A step declared here and not run by `main.ts` is a compile error (`done` only exists on the
 * exhausted plan type).
 */
// The shared nouns are neutral (the default shard is Driftwood Isle, a low-poly island with no pines, cabins or HDRI);
// a shard names what it really builds in SHARD_STEPS below.
const STEP_ROWS = [
  ['renderer', 'Renderer', 1],
  ['sky', 'Sky · lighting', 1],
  ['terrain', 'Terrain · heightfield', 2],
  ['cards', 'Tree cards', 1],
  ['forest', 'Trees', 2],
  ['physics', 'Physics · Rapier · navmesh', 1],
  ['edge', 'Chunk edge · water · horizon', 1],
  ['grass', 'Grass · ground cover', 2],
  ['cabins', 'Buildings', 2],
  ['props', 'Props', 1],
  ['animals', 'Animals', 1],
  ['weapon', 'Weapons · HUD', 1],
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
 * builds differs per shard), and the nouns of its downloads (`bytes`: what the DOWNLOAD line names while those bytes
 * land). The same table as the Nalati branch's (N-merge). Pine Hollow's (PINE-HOLLOW-REMASTER PH-P3), each what that
 * step really builds there: the day / night sky keys blended into the PMREM, the splat terrain, the baked pine branch
 * cards and the pines, the pond, the creek + waterfall and the painted horizon at the chunk's edge, the three cabins +
 * the mill hamlet + the landmarks (the fire lookout and its zipline, the footbridge, the standing stones), the rocks and
 * logs, the herds on their generated hulls, and the three weapons. Its weights stay the shared ones (they were measured
 * on Pine Hollow).
 */
interface ShardSteps {
  readonly steps: Partial<Record<BootStep, Partial<StepInfo>>>;
  readonly bytes?: Partial<Record<ByteKey, string>>;
}
const SHARD_STEPS: Readonly<Record<string, ShardSteps>> = {
  'pine-hollow': {
    steps: {
      sky: { label: 'Sky · day / night keys' },
      terrain: { label: 'Terrain · heightfield + splat' },
      cards: { label: 'Pine branch cards' },
      forest: { label: 'Forest · Scots pines' },
      edge: { label: 'Pond · creek · horizon' },
      grass: { label: 'Grass · ferns · litter' },
      cabins: { label: 'Cabins · hamlet · landmarks' },
      props: { label: 'Rocks · logs' },
      animals: { label: 'Herds · elk · deer · boar · bears' },
      weapon: { label: 'Crossbow · lever-action · longbow' },
    },
    bytes: {
      sky: 'sky keys · dawn to moonlight',
      trees: 'pine bark · twigs',
      cabins: 'cabin timber · stone · props',
      props: 'landmarks · creatures',
      music: 'music · every style',
    },
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
  for (const k of BOOT_STEPS) STEP_INFO[k] = { label: o?.steps[k]?.label ?? BASE_INFO[k].label, weight: o?.steps[k]?.weight ?? BASE_INFO[k].weight };
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
const LABELS: Partial<Record<ByteKey, string>> = { trees: 'tree bark · twigs', baked: 'baked textures', art: 'title art', music: 'music · every style', sfx: 'sound effects · every set' };
// a shard may name its own downloads (SHARD_STEPS `bytes`: Pine Hollow's sky keys, pine bark, landmarks · creatures)
export const byteLabel = (key: ByteKey): string => (shard ? SHARD_STEPS[shard]?.bytes?.[key] : undefined) ?? LABELS[key] ?? STEP_INFO[closedBy(key)].label.toLowerCase();
