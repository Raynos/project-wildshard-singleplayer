import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { mergeProjectBlobs, type ProjectOutput } from '@wildshard/sdk/projectOutput';
import { emptyShardfile } from '@wildshard/sdk/author';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import type { AudioData } from '@wildshard/sdk/audio';
import { plotAudioClientPlan, plotAudioData, type PlotAudioSpot } from './audio';

/** Source-owned audio paths and anchors; activation requires every actual file. */
export interface PlotAudioBinding {
  readonly idea: string;
  readonly source: NonNullable<NonNullable<AudioData['music']>['source']>;
  readonly sfxDir: string;
  readonly files: Readonly<Record<string, string>>;
  readonly spots: readonly PlotAudioSpot[];
}

/** The ordinary generated-declaration contract adds late audio blobs and the
 * existing native audio scene to a plot's unmodified world declaration. */
export async function generatePlotAudioProject<T extends Pick<Shardfile, 'identity' | 'audio' | 'files' | 'library' | 'budgets'>>(
  ctx: Pick<ProjectGenerationContext, 'cached'>, shard: T, binding: PlotAudioBinding,
): Promise<{ shard: T & { audio: AudioData }; output: ProjectOutput }> {
  const audio = plotAudioData(binding.idea, binding.spots, binding.source);
  if (shard.files.length > 0 || shard.library.length > 0 || shard.budgets.library.resident !== 0 || shard.budgets.library.compressed !== 0) throw new Error('Plot audio requires its unbaked world declaration');
  if (!/^\/assets\/sfx\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/u.test(binding.sfxDir)) throw new Error('Invalid plot SFX directory');
  const ids = ['score', 'ambience', ...binding.spots.map(row => row.id)];
  if (Object.keys(binding.files).length !== ids.length) throw new Error('Plot audio requires exactly its recording filenames');
  const paths = ids.map((id, index) => {
    const file = binding.files[id];
    if (file === undefined || !/^[a-z0-9][a-z0-9-]*\.m4a$/u.test(file)) throw new Error('Invalid plot recording filename');
    return `${index === 0 ? binding.source.dir : binding.sfxDir}${file}`;
  });
  const inputs = await ctx.cached({ id: `audio-${binding.idea}`, inputs: paths }, files => files);
  let total = 0;
  const blobs = paths.map((path, index) => {
    const bytes = inputs.get(path);
    if (bytes === undefined) throw new Error(`Missing plot recording: ${path}`);
    total += bytes.byteLength;
    if (bytes.byteLength > 1_000_000) throw new Error('Plot recording exceeds its blob limit');
    const name = `audio/${ids[index]}.m4a`;
    return nameBlob(name, 'audio', bytes);
  });
  if (total > 3_000_000) throw new Error('Plot runtime audio exceeds 3 MB');
  const emitted = emitNamedBlobs(blobs);
  // Charge through the normal SDK merger before adding recording references:
  // the whole-shard parser refuses references outside its library closure.
  const charged = mergeProjectBlobs(emptyShardfile(shard.identity), new Map(), blobs).shard;
  audio.recordings = Object.fromEntries(paths.map((path, index) => {
    const blob = blobs[index]; if (blob === undefined) throw new Error('Missing plot audio blob');
    return [path, blob.file.hash];
  }));
  return { shard: { ...shard, audio, files: charged.files, library: charged.library,
    budgets: { ...shard.budgets, library: charged.budgets.library } }, output: {
    namedFiles: emitted.files, assets: emitted.assets, late: emitted.files.map(file => ({ hash: file.hash })),
    platform: emitPlatformSections(new Map([['client/plan', plotAudioClientPlan()]])),
  } };
}
