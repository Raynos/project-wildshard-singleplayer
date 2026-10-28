import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readOutputDownloadIndex } from '../../src/format/outputDownload';
import { parseAudioData } from '../../src/format/audio';
import { createCatalogueAudio } from '../../src/engine/audio/levelAudio';
import { MUSIC_STYLES } from '../../src/engine/ui/Settings';

/** The same declared after-control files as the native catalogue, without decoding
 * or fetching a recording. Control clips never join these transport parts. */
export async function lateAudioGroups(root: string, slug: string): Promise<Readonly<Record<string, readonly string[]>>> {
  const directory = resolve(root, 'out', slug), path = resolve(directory, 'shard.json');
  if (!existsSync(path)) return {};
  const index = readOutputDownloadIndex(JSON.parse(readFileSync(path, 'utf8')));
  const row = index.sections.find(section => section.name === 'audio/audio');
  if (row === undefined) return {};
  const bytes = readFileSync(resolve(directory, row.path));
  if (bytes.length !== row.bytes || createHash('sha256').update(bytes).digest('hex') !== row.hash) throw new Error('Audio section differs from its product');
  const value: unknown = JSON.parse(bytes.toString('utf8'));
  if (typeof value !== 'object' || value === null || !('audio' in value)) throw new Error('Missing product audio declaration');
  const data = parseAudioData(value.audio);
  if (data.music === undefined || data.samples?.catalogue === undefined && data.music.setCatalogue === undefined) return {};
  const profile = await createCatalogueAudio(data);
  const groups: Record<string, readonly string[]> = {};
  for (const style of MUSIC_STYLES) {
    const boot = profile.bootFiles(style), control = new Set(profile.controlFiles?.(style) ?? boot);
    const files = [...new Set(boot)].filter(file => !control.has(file));
    if (files.length > 0) groups[`${slug}-audio-${style}`] = files;
  }
  return groups;
}
