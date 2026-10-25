import type { OutputFile } from './outputIndex';

/** Detect the explicit disk envelope, including unsupported versions that must refuse. */
export function isOutputIndex(input: unknown): boolean { return typeof input === 'object' && input !== null && 'format' in input && input.format === 'wildshard.shardfile'; }

/** Validated relative blob path, independent of a server base URL. */
export function outputBlobPath(file: Pick<OutputFile, 'kind' | 'hash' | 'path'>): string {
  const extensions: Record<OutputFile['kind'], readonly string[]> = { glb: ['glb'], ktx2: ['ktx2'], tile: ['wtt'], bin: ['bin'], json: ['json'], wasm: ['wasm'], image: ['webp', 'jpg', 'png'], audio: ['mp3', 'ogg', 'wav', 'm4a'] };
  if (!extensions[file.kind].some(ext => file.path === `blobs/${file.kind}/${file.hash}.${ext}`)) throw new Error('Blob path differs from its kind and hash');
  return file.path;
}
