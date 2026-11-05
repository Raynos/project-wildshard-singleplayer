import * as v from 'valibot';
import { ShardHashSchema, ShardNaturalSchema } from './shardSections.ts';

/** J91: the extensions a server-class file is written with, by kind. */
const SERVER_EXTENSIONS = { json: 'json', bin: 'bin', tile: 'wtt' } as const;
/** One server-class file: named, hashed and validated like any product file, but held apart from `index.files`. */
export interface ServerFile { name: string; path: string; hash: string; bytes: number; kind: keyof typeof SERVER_EXTENSIONS; schema?: string }
export type AdmissionServer = ServerFile[];
const name = v.pipe(v.string(), v.maxLength(240), v.regex(/^server\/[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9][a-z0-9.-]*)*$/u));
/**
 * J91's fourth admission class, beside `critical`, `late` and `library`. The rows sit in `index.admission.server` and
 * nowhere else: never in `index.files`, so no client walk (fetch list, prefetch, tier selection, residency) can see
 * them, and no pack can hold one. Its bytes live under `server/`, which the app publisher does not copy.
 * A JSON row names the defining schema of its registered platform family; a binary row has none.
 */
export const AdmissionServerSchema: v.GenericSchema<AdmissionServer, AdmissionServer> = v.pipe(
  v.array(v.strictObject({ name, path: v.pipe(v.string(), v.maxLength(240)), hash: ShardHashSchema, bytes: ShardNaturalSchema,
    kind: v.picklist(['json', 'bin', 'tile']), schema: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(240))) })),
  v.maxLength(256),
  v.check(rows => rows.every(row => row.path === serverFilePath(row.kind, row.hash)), 'server files live at their kind and hash under server/'),
  v.check(rows => rows.every(row => (row.kind === 'json') === (row.schema !== undefined)), 'server JSON alone names a defining schema'),
  v.check(rows => new Set(rows.map(row => row.name)).size === rows.length && new Set(rows.map(row => row.hash)).size === rows.length, 'unique server files'),
);
/** Where a server-class file is written, relative to its product. */
export function serverFilePath(kind: ServerFile['kind'], hash: string): string { return `server/${kind}/${hash}.${SERVER_EXTENSIONS[kind]}`; }
/** The server class is exclusive: a file a client may read is that file's client class, never both. */
export function serverFilesExclusive(rows: readonly ServerFile[], files: readonly { readonly hash: string; readonly name?: string }[]): boolean {
  const hashes = new Set(files.map(file => file.hash)), names = new Set(files.flatMap(file => file.name === undefined ? [] : [file.name]));
  return rows.every(row => !hashes.has(row.hash) && !names.has(row.name));
}
