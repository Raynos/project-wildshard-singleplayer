import * as v from 'valibot';
import type { ShardEntryways } from './entryways';

/** Original native WSTR terrain retained by a trusted world-only hybrid; this declaration never installs collision. */
export const NativeGroundSchema = v.strictObject({ version: v.literal(1), file: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)) });
/** The immutable native payload; resolution, seed and landscape identity derive from admitted bytes. */
export type NativeGround = v.InferOutput<typeof NativeGroundSchema>;
/** Structural native-ground reference inputs, independent of the native byte decoder. */
export interface NativeGroundSource {
  nativeGround: NativeGround | null;
  runtime: object | null;
  terrain: object | null;
  meshCollision: object | null;
  identity: { seed: number };
  files: readonly { hash: string; kind: string; dependencies: readonly string[] }[];
  critical: readonly string[];
  edge: Record<ShardEntryways[number]['edge'], { heights: readonly number[] }>;
  entryways: ShardEntryways;
}
/** Native ground is an independent critical root with one trusted collision owner, never another compiled collider. */
export function nativeGroundRules(source: NativeGroundSource): string[] {
  const data = source.nativeGround; if (data === null) return [];
  const errors: string[] = [];
  if (source.runtime === null) errors.push('native ground requires a trusted runtime declaration');
  if (source.terrain !== null || source.meshCollision !== null) errors.push('native ground and compiled collision are mutually exclusive');
  const file = source.files.find(row => row.hash === data.file);
  if (file?.kind !== 'binary' || file.dependencies.length > 0 || !source.critical.includes(data.file)) errors.push('native ground is an independent critical binary root');
  return errors;
}
