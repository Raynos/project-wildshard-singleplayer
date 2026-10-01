import { engineString } from '#engine/strings';
/**
 * The boot plan's vocabulary — the ONE place the loading screen's steps, labels, weights and
 * byte sources are declared. Ported from game-demos/trials-gauntlet-demo `src/engine/boot/steps.ts`
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
 * land). The same table as the Nalati branch's (N-merge). Pine Hollow's (PINE-HOLLOW-REMASTER PH-P3, re-read at PH-S2
 * after the trees / crags / life / rifle lanes), each what that step really builds there: the seven day / night sky keys
 * blended into the PMREM, the splat terrain on the boreal ground, the Blender species set (PH-B4: pine, fir, the
 * old-growth giants, birch, snags, saplings) and the forest planted from it, the pond, the creek + waterfall and the
 * painted far country at the chunk's edge, the ferns and bilberry of the understory, the three cabins + the mill hamlet +
 * the landmarks (the fire lookout and its zipline, the footbridge, the standing stones) + the Ridge's granite and the bear
 * cave (PH-B2), the rocks and logs, the herds on their generated hulls, the three weapons, and its own score (theme 1,
 * night, the King's stems, the dawn sting) + the zoned beds and the one-shot sprite. Its weights stay the shared ones
 * (they were measured on Pine Hollow).
 *
 * Nalati: Nalati builds its whole world in `props` (wireNalati) and has no cabins, forest or
 * undergrowth to speak of; the weights are its measured wall-ms shape (phone tier, 2026-09-23: props 860, sky 245,
 * shaders 220, terrain 175, grass 40, first frame 40 ms, the rest < 15), the first-run bar's pace until this device has
 * timed a load of its own. `trees` is the byte label of the `cards` step's download.
 */
interface ShardSteps {
  readonly steps: Partial<Record<BootStep, Partial<StepInfo>>>;
  readonly bytes?: Partial<Record<ByteKey, string>>;
}
const SHARD_STEPS: Readonly<Record<string, ShardSteps>> = {
  'pine-hollow': {
    steps: {
      sky: { label: engineString('s_3c6529f5a000') },
      terrain: { label: engineString('s_dcf5eeb91b74') },
      cards: { label: engineString('s_ec28a23a640e') },
      forest: { label: engineString('s_00cc30d60f47') },
      edge: { label: engineString('s_5baf0ab3f19d') },
      grass: { label: engineString('s_ed918043f058') },
      cabins: { label: engineString('s_4be1a7b1ed2f') },
      props: { label: engineString('s_00de1db385da') },
      animals: { label: engineString('s_e7fc1dad792d') },
      weapon: { label: engineString('s_f862cea32c63') },
      audio: { label: engineString('s_0ed7016d19bc') },
    },
    bytes: {
      sky: 'sky keys · dawn to moonlight',
      trees: 'tree species · bark · needles',
      cabins: 'cabin timber · stone · props',
      props: 'landmarks · crags · creatures',
      music: 'score · day · night · the King · dawn',
      sfx: 'forest beds · rain · calls · barks',
    },
  },

};

let shard: string | null = null;
let ownBytes: Readonly<Partial<Record<ByteKey, string>>> | undefined;
/**
 * The active shard's nouns + weights over the table (main.ts, before the boot plan is made). A shard without its own
 * rows keeps the shared table exactly, and its load timings stay under the shared key (`shardTimingKey`).
 */
export function useShardSteps(slug: string, steps?: Readonly<Record<string, { label: string; weight: number }>>, bytes?: Readonly<Partial<Record<ByteKey, string>>>): void {
  const o = SHARD_STEPS[slug];
  shard = o || steps !== undefined ? slug : null;
  ownBytes = bytes;
  for (const k of BOOT_STEPS) STEP_INFO[k] = { label: steps?.[k]?.label ?? o?.steps[k]?.label ?? BASE_INFO[k].label, weight: steps?.[k]?.weight ?? o?.steps[k]?.weight ?? BASE_INFO[k].weight };
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
export const byteLabel = (key: ByteKey): string => ownBytes?.[key] ?? (shard ? SHARD_STEPS[shard]?.bytes?.[key] : undefined) ?? LABELS[key] ?? STEP_INFO[closedBy(key)].label.toLowerCase();
