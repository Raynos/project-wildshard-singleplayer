import { resolve } from 'node:path';

/** Only the isolated practice caller in gait5 opts into visual continuation. No global alias or barrel. */
export function pufferPreviewPoseRoute(mode: string, source: string, importer: string | undefined, root: string): string | null {
  return mode === 'gait5' && source === './game/plugin/channelPrograms' && importer === resolve(root, 'src/practiceContent.ts')
    ? resolve(root, 'src/pufferGaitContinuityPreview.ts') : null;
}
