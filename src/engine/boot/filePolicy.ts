import { GPU_FILES as ENGINE_GPU_FILES } from './ktx2.generated';
import { PUBLIC_BYTES } from './bytes.generated';
import type { Tier } from '../core/tier';
import type { Ktx2Table, TexMode } from './gpuFiles';

export { PUBLIC_BYTES } from './bytes.generated';
interface FilePolicy { phone: (url: string) => string; gpu: (url: string) => string; layer: (url: string) => string; pbr: (id: string) => string[] }
/** Pure asset-name resolution for node-safe manifest file lists. */
export function filePolicy(tier: Tier, mode: TexMode, table: Ktx2Table): FilePolicy {
  const files = { ...ENGINE_GPU_FILES[tier], ...table[tier] };
  const phone = (url: string): string => {
    if (tier !== 'phone') return url;
    const match = /^(.*)\.(png|jpg|webp|glb)$/.exec(url);
    if (match === null) return url;
    const candidate = `${match[1]}.phone.${match[2] === 'glb' ? 'glb' : 'webp'}`;
    return candidate in PUBLIC_BYTES ? candidate : url;
  };
  const gpu = (url: string): string => { const mapped = phone(url); return mode === 'ktx2' ? files[mapped] ?? mapped : mapped; };
  const layer = (url: string): string => { const mapped = phone(url); return mode === 'ktx2' ? files[`${mapped}#layer`] ?? mapped : mapped; };
  const pbr = (id: string): string[] => ['diffuse', 'nor_gl', 'arm'].map((kind) => {
    const base = `/assets/tex/${id}/${kind}`;
    return tier === 'phone' && `${base}_1k.jpg` in PUBLIC_BYTES ? `${base}_1k.jpg` : `${base}.jpg`;
  });
  return { phone, gpu, layer, pbr };
}
