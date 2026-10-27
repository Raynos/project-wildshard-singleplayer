import * as v from 'valibot';

interface Measured { readonly path: string; readonly hash: string; readonly bytes: number }
export interface OutputDownloadIndex {
  readonly sections: readonly (Measured & { readonly name: string })[];
  readonly schemas: readonly Measured[];
  readonly files: readonly { readonly path: string; readonly hash: string; readonly compressed: number; readonly name?: string }[];
  readonly runtime?: unknown;
  /** iPhone downloads I5: content-hashed packs of the small members (format/outputIndex) */
  readonly packs?: readonly (Measured & { readonly entries: readonly { readonly hash: string; readonly offset: number; readonly bytes: number }[] })[];
}
/** Download metadata only, independent of gameplay schemas. This never admits
 * or publishes a Shardfile. Browser callers first verify the complete index
 * against its build hash; unverified admission keeps the full defining parser. */
export function readOutputDownloadIndex(input: unknown): OutputDownloadIndex {
  const path = v.pipe(v.string(), v.regex(/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/u));
  const bytes = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
  const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
  const measured = { path, hash, bytes };
  const index = v.parse(v.object({ format: v.literal('wildshard.shardfile'), formatVersion: v.literal(2),
    sections: v.pipe(v.array(v.object({ ...measured, name: v.string() })), v.maxLength(256)),
    schemas: v.pipe(v.array(v.object(measured)), v.maxLength(128)),
    files: v.pipe(v.array(v.object({ path, hash, compressed: bytes, name: v.exactOptional(v.string()) })), v.maxLength(8192)),
    runtime: v.unknown(),
    packs: v.exactOptional(v.pipe(v.array(v.object({ ...measured, entries: v.pipe(v.array(v.object({ hash, offset: bytes, bytes })), v.maxLength(8192)) })), v.maxLength(64))),
  }), input);
  const paths = ['shard.json', 'validation.json', ...index.sections.map(row => row.path), ...index.schemas.map(row => row.path), ...index.files.map(row => row.path)];
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate product download path');
  return index;
}
