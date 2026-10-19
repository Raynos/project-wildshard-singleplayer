import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import layout from '../data/layout.generated.json' with { type: 'json' };

/** Unit quads keep their original instance bases for interior mapping.
 * Native float32 packets split the 9,912 windows below the host cap. */
export function facadeWindowBlobs(): NamedBlob[] {
  const c = layout.rows.counts, start = (c.walkers + c.sitters + c.lanterns + c.acs) * 16
    + c.hooks * 3 + c.hookMounts * 6 + c.steam * 3 + c.pieces * 19;
  const records = layout.records.map(value => value === '-0' ? -0 : Number(value));
  return Array.from({ length: Math.ceil(c.windows / 4096) }, (_, index) => {
    const first = index * 4096, count = Math.min(4096, c.windows - first);
    const packet = new Float32Array(count * 26);
    for (let i = 0; i < count; i++) {
      const at = start + (first + i) * 26;
      packet.set(records.slice(at, at + 16), i * 16);
      packet.set(records.slice(at + 16, at + 20), count * 16 + i * 4);
      packet.set(records.slice(at + 20, at + 23), count * 20 + i * 3);
      packet.set(records.slice(at + 23, at + 26), count * 23 + i * 3);
    }
    return nameBlob(`geometry/facade-windows-${index}.bin`, 'bin', new Uint8Array(packet.buffer), { gpu: packet.byteLength + 140 });
  });
}
