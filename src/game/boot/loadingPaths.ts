import { BOOT_STEPS, STEP_INFO } from '@wildshard/engine/boot/steps';
import type { Loading } from '@wildshard/engine/ui/Loading';
import type { GridCrossingTiming } from '../grid/crossing';

export type LoadingPathId = 'legacy' | 'shardfile' | 'grid' | 'crossing' | 'cell';
type Path = Parameters<Loading['setPath']>[0];
const step = (key: string, label: string, aliases: readonly string[] = []): Path['steps'][number] => ({ key, label, aliases, weight: 1 });
/** A grid shell has no regional terrain, trees or physics to report; its real home has its own row. */
export function loadingPath(id: LoadingPathId, own?: Readonly<Record<string, { label: string; weight: number }>>, hybrid = false): Path {
  const early = [step('modules', 'Application modules', ['manifest.load']), step('admission', 'Product admission', ['product']),
    step('data', 'Texture and audio preparation', ['level.data', 'ktx2', 'audio.preload'])];
  const shared = [step('world', 'Region world', ['level.world', 'render', 'structures', 'structures.build']),
    step('loadout', 'Equipment and HUD', ['level.kit', 'roster', 'fieldModels', 'sword']),
    step('gameplay', 'Gameplay and saved state', ['level.play']), step('finish', 'Final activation', ['finish'])];
  if (id === 'legacy' || hybrid) return { id, steps: [...early, ...BOOT_STEPS.map(key => ({ key, label: own?.[key]?.label ?? STEP_INFO[key].label, weight: own?.[key]?.weight ?? STEP_INFO[key].weight })), ...shared] };
  // G555: a grid cell entry or re-entry shows the same step-by-step screen as SHARD SELECT, over the region's live admission
  if (id === 'cell') return { id, steps: [step('admission', 'Product admission'), step('world', 'Region world'),
    step('loadout', 'Equipment and HUD'), step('gameplay', 'Gameplay and saved state'), step('warm', 'Entry warm-up'),
    step('colliders', 'Colliders and simulation'), step('enter', 'Enter the cell')], ignored: [] };
  if (id === 'crossing') return { id, steps: [step('prepare', 'Prepare destination'), step('boundary', 'Await transfer boundary'),
    step('checkpoint', 'Save source state'), step('commit', 'Enter destination'), step('activate', 'Activate destination')], ignored: [] };
  const selected = new Set(['renderer', 'weapon', 'menu', 'shaders', 'firstFrame', 'audio', ...(id === 'grid' ? ['assembly'] : [])]);
  const actual = BOOT_STEPS.filter(key => selected.has(key)).map(key => ({ key, label: own?.[key]?.label ?? STEP_INFO[key].label, weight: STEP_INFO[key].weight }));
  return { id, steps: [...early, ...actual, ...shared,
    ...(id === 'grid' ? [step('home', 'Home region', ['crossing']), step('homePrograms', 'Home region shader preparation')] : [])],
    ignored: BOOT_STEPS.filter(key => !selected.has(key)) };
}

/** Crossings retain their existing unobstructed play view; the live diagnostic uses this separate, exact phase table. */
export function crossingLoadingRows(timing: GridCrossingTiming): { key: string; label: string; ms: number }[] {
  const boundaries = [timing.requestedAt, timing.readyAt, timing.start, timing.checkpointEnd, timing.commitEnd, timing.end];
  return loadingPath('crossing').steps.map((row, index) => ({ key: row.key, label: row.label,
    ms: Math.max(0, (boundaries[index + 1] ?? 0) - (boundaries[index] ?? 0)) }));
}
