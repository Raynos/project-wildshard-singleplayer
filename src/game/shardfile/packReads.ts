import type { OutputIndex } from '@wildshard/format/outputIndex';

/** iPhone downloads I5: a phase's packed members (I5.1's `index.packs`) served from one verified read of each pack. */
export interface PackReads {
  /** whether `hash` is a member of one of this phase's packs */
  readonly has: (hash: string) => boolean;
  /** the member's exact bytes (an owned copy); the pack is read and hash-checked once, then held only by this reader */
  readonly read: (hash: string) => Promise<Uint8Array>;
}

/** One phase's pack reads (a descriptor's sections, or an admission's files): `members` limits which packs it may read,
 *  so a phase never fetches the other phase's pack. The reader is local to its call; dropping it drops the pack bytes. */
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
  const whole = new Map<string, Promise<Uint8Array>>();
  return {
    has: member => where.has(member),
    read: async member => {
      const at = where.get(member);
      if (at === undefined) throw new Error('Not a packed member');
      let bytes = whole.get(at.pack.hash);
      if (bytes === undefined) {
        bytes = (async () => {
          const wire = await read(at.pack.path, at.pack.bytes);
          if (wire.length !== at.pack.bytes || await hash(wire) !== at.pack.hash) throw new Error('Shardfile pack hash or size mismatch');
          return wire;
        })();
        whole.set(at.pack.hash, bytes);
      }
      return (await bytes).slice(at.offset, at.offset + at.bytes);
    },
  };
}
