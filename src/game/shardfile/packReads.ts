import type { OutputIndex } from '@wildshard/format/outputIndex';

type Pack = NonNullable<OutputIndex['packs']>[number];
const wholePacks = new WeakMap<object, Map<string, Promise<Uint8Array>>>();

/** One verified whole GET per immutable index inventory, shared across admission
 * and later demand waves. Failed attempts leave no retained rejection. The weak
 * owner lets the bytes go with their product, rather than a global URL cache. */
export function readPackWhole(owner: object, pack: Pack,
  read: (path: string, maximum: number) => Promise<Uint8Array>, hash: (bytes: Uint8Array) => Promise<string>): Promise<Uint8Array> {
  if (pack.bytes < 1 || pack.bytes > 4_194_304) return Promise.reject(new Error('Shardfile pack size exceeds 4 MiB'));
  let whole = wholePacks.get(owner);
  if (whole === undefined) { whole = new Map(); wholePacks.set(owner, whole); }
  const previous = whole.get(pack.hash);
  if (previous !== undefined) return previous;
  const held = whole;
  const bytes = (async () => {
    const wire = await read(pack.path, pack.bytes);
    if (wire.length !== pack.bytes || await hash(wire) !== pack.hash) throw new Error('Shardfile pack hash or size mismatch');
    return wire;
  })();
  held.set(pack.hash, bytes);
  void bytes.catch(() => { if (held.get(pack.hash) === bytes) held.delete(pack.hash); });
  return bytes;
}

/** iPhone downloads I5: a phase's packed members (I5.1's `index.packs`) served from one verified read of each pack. */
export interface PackReads {
  /** whether `hash` is a member of one of this phase's packs */
  readonly has: (hash: string) => boolean;
  /** the member's exact bytes (an owned copy); the pack is read and hash-checked once, then held only by this reader */
  readonly read: (hash: string) => Promise<Uint8Array>;
}

/** One phase's pack reads (a descriptor's sections, or an admission's files): `members` limits which packs it may read,
 *  so a phase never fetches the other phase's pack. Whole verified bytes are shared only within this index's lifetime. */
export function packReads(packs: OutputIndex['packs'], members: ReadonlySet<string>,
  read: (path: string, maximum: number) => Promise<Uint8Array>, hash: (bytes: Uint8Array) => Promise<string>): PackReads {
  const where = new Map<string, { readonly pack: NonNullable<OutputIndex['packs']>[number]; readonly offset: number; readonly bytes: number }>();
  for (const pack of packs ?? []) {
    // Admission may request only the control subset of a compiler pack. Do not
    // download its deferred bodies here, discard them, then fetch them again
    // when their real owner asks. Complete phases still share one verified read.
    if (!pack.entries.every(entry => members.has(entry.hash))) continue;
    for (const entry of pack.entries) {
      if (!where.has(entry.hash)) where.set(entry.hash, { pack, offset: entry.offset, bytes: entry.bytes });
    }
  }
  return {
    has: member => where.has(member),
    read: async member => {
      const at = where.get(member);
      if (at === undefined) throw new Error('Not a packed member');
      const bytes = readPackWhole(packs ?? where, at.pack, read, hash);
      return (await bytes).slice(at.offset, at.offset + at.bytes);
    },
  };
}
