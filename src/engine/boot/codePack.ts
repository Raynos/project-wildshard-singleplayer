import type { Scope } from '../app/scope';
import { declareDownloadFile, noteDownloadRead, beginLoadingWait, reportLoadingWait, finishLoadingWait } from './download';

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
 * Both handshake and started transfer are bounded. A stalled worker yields to
 * the original per-module path instead of retaining the title handoff forever. */
export async function prepareCodePack(input: unknown, owner: Scope): Promise<(() => void) | null> {
  const [url, bytes, decoded] = readCodePack(input), worker = navigator.serviceWorker?.controller;
  if (worker === null || worker === undefined || owner.disposed) return null;
  const declare = (): void => { declareDownloadFile(url, bytes); };
  const channel = new MessageChannel();
  let stored = false, received = 0;
  const waitId = beginLoadingWait('application code download', { kind: 'file', totalBytes: bytes, resource: url });
  const shell = document.querySelector<HTMLElement>('.ws-load');
  const progress = (loaded: number): void => {
    noteDownloadRead(loaded - received); received = loaded;
    reportLoadingWait(waitId, { loadedBytes: loaded });
    if (shell !== null) {
      shell.dataset['codePackUrl'] = url; shell.dataset['codePackLoaded'] = String(loaded);
      shell.dataset['codePackTotal'] = String(bytes);
    }
  };
  await new Promise<void>(resolve => {
    let ended = false;
    let cancelDeadline = (): void => { /* Installed before the worker is messaged. */ };
    const finish = (): void => {
      if (ended) return;
      ended = true; finishLoadingWait(waitId); cancelDeadline(); channel.port1.close(); channel.port2.close();
      if (!stored && shell?.dataset['codePackUrl'] === url) {
        delete shell.dataset['codePackUrl']; delete shell.dataset['codePackLoaded']; delete shell.dataset['codePackTotal'];
      }
      resolve();
    };
    const timer = owner.timeout(2500, finish);
    cancelDeadline = (): void => { owner.cancelTimer(timer); };
    let started = false;
    owner.onDispose(finish);
    channel.port1.onmessage = (event: MessageEvent<unknown>): void => {
      const data = event.data;
      if (typeof data !== 'object' || data === null || !('type' in data)) return;
      if (data.type === 'CODE_PACK_STARTED' && !started) {
        started = true; progress(0); owner.cancelTimer(timer);
        const transfer = owner.timeout(15000, finish);
        cancelDeadline = (): void => { owner.cancelTimer(transfer); };
      }
      else if (data.type === 'CODE_PACK_PROGRESS' && started
        && 'url' in data && data.url === url && 'total' in data && data.total === bytes
        && 'loaded' in data && typeof data.loaded === 'number' && Number.isSafeInteger(data.loaded)
        && data.loaded >= received && data.loaded <= bytes) progress(data.loaded);
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
