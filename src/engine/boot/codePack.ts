import type { Scope } from '../app/scope';
import { declareDownloadFile } from './download';

/** Compiler-owned, content-addressed transport; module URLs remain unchanged. */
export function readCodePack(input: unknown): readonly [string, number, number] {
  if (!Array.isArray(input) || input.length !== 4) throw new Error('Invalid code pack');
  const url: unknown = input[0], bytes: unknown = input[1], decoded: unknown = input[2], members: unknown = input[3];
  if (typeof url !== 'string' || !/^\/assets\/code\/[a-f0-9]{64}\.pack$/u.test(url)
    || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 32 * 1024 * 1024
    || typeof decoded !== 'number' || !Number.isSafeInteger(decoded) || decoded < 12 || decoded > 32 * 1024 * 1024
    || !Array.isArray(members) || members.length === 0 || members.length > 4096
    || members.some((value: unknown) => typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid code pack');
  return [url, bytes, decoded];
}

/** Ask the controlling worker to verify and durably publish the existing code
 * bank. Unsupported workers/storage failures retain normal per-module fetches.
 * Only the initial protocol handshake is timed; a started transfer is owned by
 * the original boot/network deadline rather than a second competing download. */
export async function prepareCodePack(input: unknown, owner: Scope): Promise<(() => void) | null> {
  const [url, bytes, decoded] = readCodePack(input), worker = navigator.serviceWorker?.controller;
  if (worker === null || worker === undefined || owner.disposed) return null;
  const declare = (): void => { declareDownloadFile(url, bytes); };
  const channel = new MessageChannel();
  let stored = false;
  await new Promise<void>(resolve => {
    let ended = false;
    let cancelHandshake = (): void => { /* Installed before the worker is messaged. */ };
    const finish = (): void => {
      if (ended) return;
      ended = true; cancelHandshake(); channel.port1.close(); channel.port2.close(); resolve();
    };
    const timer = owner.timeout(2500, finish);
    cancelHandshake = (): void => { owner.cancelTimer(timer); };
    owner.onDispose(finish);
    channel.port1.onmessage = (event: MessageEvent<unknown>): void => {
      const data = event.data;
      if (typeof data !== 'object' || data === null || !('type' in data)) return;
      if (data.type === 'CODE_PACK_STARTED') owner.cancelTimer(timer);
      else if (data.type === 'CODE_PACK_DONE') {
        stored = 'status' in data && data.status === 'stored'; finish();
      }
    };
    try { worker.postMessage({ type: 'PREPARE_CODE_PACK', url, bytes, decoded }, [channel.port2]); }
    catch { finish(); }
  });
  if (owner.disposed) throw new Error('Retired code pack preparation');
  return stored ? declare : null;
}
