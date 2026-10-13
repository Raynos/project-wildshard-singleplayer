import { GPU_FILES as ENGINE_GPU_FILES } from './ktx2.generated';
import { publicBytes } from './tables';
import type { Tier } from '../core/tier';
import type { Ktx2Table, TexMode } from './gpuFiles';
import type { BootSpec } from '../level/spec';
import type { ChunkFiles } from './bytes';

interface FilePolicy { phone: (url: string) => string; gpu: (url: string) => string; layer: (url: string) => string; pbr: (id: string) => string[] }
/** Pure asset-name resolution for node-safe manifest file lists. */
export function filePolicy(tier: Tier, mode: TexMode, table: Ktx2Table): FilePolicy {
  const files = { ...ENGINE_GPU_FILES[tier], ...table[tier] };
  const phone = (url: string): string => {
    if (tier !== 'phone') return url;
    const match = /^(.*)\.(png|jpg|webp|glb)$/.exec(url);
    if (match === null) return url;
    const candidate = `${match[1]}.phone.${match[2] === 'glb' ? 'glb' : 'webp'}`;
    return candidate in publicBytes() ? candidate : url;
  };
  const gpu = (url: string): string => { const mapped = phone(url); return mode === 'ktx2' ? files[mapped] ?? mapped : mapped; };
  const layer = (url: string): string => { const mapped = phone(url); return mode === 'ktx2' ? files[`${mapped}#layer`] ?? mapped : mapped; };
  const pbr = (id: string): string[] => ['diffuse', 'nor_gl', 'arm'].map((kind) => {
    const base = `/assets/tex/${id}/${kind}`;
    return tier === 'phone' && `${base}_1k.jpg` in publicBytes() ? `${base}_1k.jpg` : `${base}.jpg`;
  });
  return { phone, gpu, layer, pbr };
}

/** Resolve authored rows in their original order; frozen callable inventories retain their exact arguments. */
export function bootSourceFiles(sources: NonNullable<BootSpec['sources']>, tier: Tier, tex: TexMode): ChunkFiles {
  if (typeof sources === 'function') return sources(tier, tex);
  const policy = filePolicy(tier, tex, sources.gpuFiles ?? { phone: {}, desktop: {} });
  const resolve = (rows: readonly (string | { readonly gpu: string })[]): readonly string[] => rows.map(row => typeof row === 'string' ? row : policy.gpu(row.gpu));
  const rows = sources.tiers[tier];
  return { sky: resolve(rows.sky), baked: resolve(rows.baked), terrain: resolve(rows.terrain), trees: resolve(rows.trees),
    physics: resolve(rows.physics), cabins: resolve(rows.cabins), props: resolve(rows.props), art: resolve(rows.art), music: resolve(rows.music), sfx: resolve(rows.sfx) };
}

/** Resolve a declared ordered file list, including inventories intentionally pinned to one source tier. */
export function bootFileList(files: BootSpec['files'], tier: Tier): readonly string[] {
  if (typeof files === 'function') return files(tier);
  if ('sources' in files) return Object.values(bootSourceFiles(files.sources, files.tier, files.tex)).flat();
  return files;
}

/** Resolve late reads without running author-specific callbacks for row declarations. */
export function bootLateReads(reads: BootSpec['lateReads'], tier: Tier, tex?: TexMode): readonly string[] {
  return typeof reads === 'function' ? reads(tier, tex) : reads ?? [];
}
