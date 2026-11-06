import * as v from 'valibot';

/** C2 (J28, J134): each product's server class as one content-named part, so a deployed build has no `/server-class/`
 *  tree. The book is per build, like the packs book, and only the server worker reads it: it is in no client manifest, the
 *  precache never names it, and anyone can download it, so nothing secret goes in a server file (J134). */
export interface ServerPack {readonly url: string; readonly bytes: number; readonly hash: string; readonly wireBytes: number; readonly files: readonly (readonly [string, number, number])[]}
export interface ServerPackBook {readonly book: 'server'; readonly build: string; readonly shards: Readonly<Record<string, ServerPack>>; /** C2: the road's collision, one per catalogue. */ readonly grid?: ServerPack}
const size = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const ServerPackSchema: v.GenericSchema<ServerPack> = v.strictObject({url: v.pipe(v.string(), v.regex(/^\/assets\/spawn\/server\/[a-f0-9]{16}\.pack\.br$/u)), bytes: size, hash: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)), wireBytes: size,
  files: v.array(v.strictTuple([v.string(), size, size]))});
const ServerPackBookSchema: v.GenericSchema<ServerPackBook> = v.strictObject({book: v.literal('server'), build: v.string(), shards: v.record(v.string(), ServerPackSchema), grid: v.exactOptional(ServerPackSchema)});
export const serverPackBookPath = (build: string): string => `assets/spawn/server-${build}.json`;
export const readServerPackBook = (input: unknown): ServerPackBook => v.parse(ServerPackBookSchema, input);
/** One file's bytes inside its pack's decoded body. */
export function serverPackFile(pack: ServerPack, body: Uint8Array, path: string): Uint8Array | undefined {
  const row = pack.files.find(file => file[0] === path);
  return row === undefined ? undefined : body.subarray(row[1], row[1] + row[2]);
}
