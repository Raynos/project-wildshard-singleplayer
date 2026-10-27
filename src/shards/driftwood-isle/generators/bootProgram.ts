import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { driftwoodBootInventory } from './bootInventory';
import { driftwoodCapturePoses } from './capturePoses';
import inputs from '../data/publicInputs.json' with { type: 'json' };

/** Resolve original ordered boot recipes and diagnostic eyes as bounded discovery data. */
export function driftwoodBootProgram(ctx: Pick<ProjectGenerationContext, 'inputFiles'>): {
  'boot.files': ReturnType<typeof driftwoodBootInventory>['files'];
  'boot.sources': ReturnType<typeof driftwoodBootInventory>['sources'];
  'boot.lateReads': ReturnType<typeof driftwoodBootInventory>['lateReads'];
  poses: ReturnType<typeof driftwoodCapturePoses>;
} {
  if (ctx.inputFiles === undefined) throw new Error('Driftwood boot discovery requires its public inventory capability');
  const inventory = Object.fromEntries(ctx.inputFiles(inputs.bootInventory).filter(url => !url.endsWith('.DS_Store')).sort().map((url): [string, true] => [url, true]));
  const rows = driftwoodBootInventory(inventory);
  return { 'boot.files': rows.files, 'boot.sources': rows.sources, 'boot.lateReads': rows.lateReads, poses: driftwoodCapturePoses() };
}
