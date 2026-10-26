import { expect, test } from 'vitest';
import { realGc } from '../test/realGc';
import { ContentCache } from './contentCache';

const file = 'src/engine/boot/content-cache-lifetime.test.ts';
const size = 512 * 1024;
async function digest(bytes: Uint8Array): Promise<string> {
  const value = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function lifetime(name: string, refuse: boolean, transfer = false): Promise<void> {
  await realGc(file, name, async collect => {
    const hash = await digest(new Uint8Array(size).fill(7));
    const buffers: WeakRef<object>[] = [], disk = new Map<string, Response>();
    let release = (): void => { throw new Error('Missing write release'); };
    let started = (): void => { throw new Error('Missing write signal'); };
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const writing = new Promise<void>(resolve => { started = resolve; });
    const key = (input: RequestInfo | URL): string => input instanceof Request ? input.url : String(input);
    const cache = new ContentCache({ origin: 'https://cache.test', maxBytes: size * 2, reserveBytes: 0,
      hash: bytes => { buffers.push(new WeakRef(bytes.buffer)); return digest(bytes); },
      storage: { open: () => Promise.resolve({
        match: input => Promise.resolve(disk.get(key(input))?.clone()),
        keys: () => Promise.resolve([...disk.keys()].map(url => new Request(url))),
        delete: input => Promise.resolve(disk.delete(key(input))),
        put: async (input, response) => {
          if (key(input).endsWith(hash)) {
            started(); await blocked;
            if (refuse) throw new DOMException('No disk capacity', 'QuotaExceededError');
          }
          disk.set(key(input), response.clone());
        },
      }) },
    });
    const input = transfer ? new Uint8Array(size).fill(7) : null;
    let returned = false;
    let read: Promise<Uint8Array> | undefined = input === null
      ? cache.load(hash, () => Promise.resolve(new Uint8Array(size).fill(7)))
      : cache.putTransferred(hash, input).then(result => { returned = true; expect(result.stored).toBe(!refuse); return result.bytes; });
    let caller: Uint8Array;
    try {
      if (input !== null) {
        expect(input.byteLength).toBe(0); await writing; expect(returned).toBe(false); release();
      }
      caller = await read; await writing;
      expect(caller.byteLength).toBe(size);
      expect(buffers).toHaveLength(transfer ? 1 : 2);
      expect(buffers.every(ref => ref.deref() !== undefined)).toBe(true);
      expect(caller.buffer === buffers[0]?.deref()).toBe(transfer);
      caller.fill(9); // Returned bytes cannot mutate the completed durable write.
      if (transfer) { expect(caller.every(byte => byte === 9)).toBe(true); caller = new Uint8Array(); read = undefined; }
    } finally { release(); await cache.flush(); }
    for (const ref of buffers) await collect(ref);
    // Keep the same cache alive through collection, then use its real disk path.
    expect(await cache.stats()).toEqual({entries: refuse ? 0 : 1, bytes: refuse ? 0 : size});
    const again = await cache.get(hash);
    if (refuse) {
      expect(again).toBeNull();
      await expect(cache.load(hash, () => Promise.reject(new Error('Unexpected offline network')), true)).rejects.toThrow('unavailable offline');
    } else {
      expect(again?.byteLength).toBe(size);
      expect(again?.every(byte => byte === 7)).toBe(true);
      if (!transfer) expect(caller.every(byte => byte === 9)).toBe(true);
    }
    await cache.flush();
  });
}

test('durable cache completion releases shared download and write backing', async () => {
  await lifetime('durable cache completion releases shared download and write backing', false);
});

test('refused cache completion releases shared backing without failing online bytes', async () => {
  await lifetime('refused cache completion releases shared backing without failing online bytes', true);
});


test('transferred durable content releases backing after its returned owner retires', async () => {
  await lifetime('transferred durable content releases backing after its returned owner retires', false, true);
});

test('transferred quota refusal returns verified online bytes and then releases backing', async () => {
  await lifetime('transferred quota refusal returns verified online bytes and then releases backing', true, true);
});
