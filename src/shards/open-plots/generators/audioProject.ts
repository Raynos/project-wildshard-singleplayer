import { emitNamedBlobs, nameBlob } from '@wildshard/sharddev/blobs';
import { emitPlatformSections } from '@wildshard/sharddev/platformSections';
import type { ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import type { ProjectOutput } from '@wildshard/sharddev/projectOutput';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import type { AudioData } from '@wildshard/sharddev/audio';
import { plotAudioClientPlan, plotAudioData, type PlotAudioSpot } from './audio';

/** Source-owned audio paths and anchors; activation requires every actual file. */
export interface PlotAudioBinding {
  readonly idea: string;
  readonly source: NonNullable<NonNullable<AudioData['music']>['source']>;
  readonly sfxDir: string;
  readonly files: Readonly<Record<string, string | Readonly<{ set: string; dir: string; file: string }>>>;
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
    const recording = binding.files[id];
    const shared = typeof recording === 'object' ? recording : undefined;
    const file = typeof recording === 'string' ? recording : shared?.file;
    if (file === undefined || !/^[a-z0-9][a-z0-9-]*\.m4a$/u.test(file)
      || (shared !== undefined && (index !== 1 || /^\/assets\/sfx\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(shared.dir)?.[1] !== shared.set))) throw new Error('Invalid plot recording filename');
    return `${shared === undefined ? index === 0 ? binding.source.dir : binding.sfxDir : shared.dir}${file}`;
  });
  const inputs = await ctx.cached({ id: `audio-${binding.idea}`, inputs: paths }, files => new Map(paths.map((path, index) => {
    const bytes = files.get(path), id = ids[index];
    if (bytes === undefined || id === undefined) throw new Error(`Missing plot recording: ${path}`);
    return [`${id}.m4a`, bytes];
  })));
  let total = 0;
  const blobs = paths.map((path, index) => {
    const bytes = inputs.get(`${ids[index]}.m4a`);
    if (bytes === undefined) throw new Error(`Missing plot recording: ${path}`);
    total += bytes.byteLength;
    if (bytes.byteLength > 1_000_000) throw new Error('Plot recording exceeds its blob limit');
    const name = `audio/${ids[index]}.m4a`;
    return nameBlob(name, 'audio', bytes);
  });
  if (total > 3_000_000) throw new Error('Plot runtime audio exceeds 3 MB');
  const emitted = emitNamedBlobs(blobs);
  // nameBlob measured each AAC's actual decoded and compressed costs. Keep
  // this config-only projection free of the CLI project compiler; the normal
  // output merger independently re-admits these exact named bytes afterward.
  if (new Set(emitted.files.map(file => file.hash)).size !== emitted.files.length) throw new Error('Plot recording identities must be distinct');
  const files: Shardfile['files'] = emitted.files.map(file => ({ hash: file.hash, kind: 'audio',
    compressed: file.compressed, decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws,
    critical: false, dependencies: file.dependencies }));
  const library = files.map(file => file.hash);
  const cost = { compressed: files.reduce((sum, file) => sum + file.compressed, 0),
    resident: files.reduce((sum, file) => sum + file.decoded + file.gpu, 0) };
  audio.recordings = Object.fromEntries(paths.map((path, index) => {
    const blob = blobs[index]; if (blob === undefined) throw new Error('Missing plot audio blob');
    return [path, blob.file.hash];
  }));
  return { shard: { ...shard, audio, files, library, budgets: { ...shard.budgets, library: cost } }, output: {
    namedFiles: emitted.files, assets: emitted.assets, late: emitted.files.map(file => ({ hash: file.hash })),
    platform: emitPlatformSections(new Map([['client/plan', plotAudioClientPlan()]])),
  } };
}
