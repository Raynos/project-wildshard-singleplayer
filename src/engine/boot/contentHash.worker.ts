export interface HashRequest { id: number; bytes: Uint8Array }
function request(value: unknown): value is HashRequest {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'number' && Number.isSafeInteger(value.id)
    && 'bytes' in value && value.bytes instanceof Uint8Array;
}
// SHA-256 copies its input before it runs: here, off the page's thread. The bytes return with the digest, transferred.
self.onmessage = (event: MessageEvent<unknown>): void => {
  const input = event.data;
  if (!request(input)) return;
  const buffer = input.bytes.buffer;
  if (!(buffer instanceof ArrayBuffer)) return;
  void (async () => {
    try {
      // the page sends bytes that own their whole buffer (contentHash.ts)
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
      const hash = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
      self.postMessage({ id: input.id, hash, bytes: input.bytes }, { transfer: [buffer] });
    } catch (error) {
      self.postMessage({ id: input.id, error: error instanceof Error ? error.message : String(error), bytes: input.bytes },
        { transfer: [buffer] });
    }
  })();
};
