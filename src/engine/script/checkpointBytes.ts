/** Exact JSON byte-array text without a boxed number[] per Wasm memory.
 * Keep the historical replay wire while writing directly into one ASCII buffer. */
export function checkpointByteText(bytes: Uint8Array): string {
  const ascii = new Uint8Array(bytes.length * 4 + 2); let at = 0;
  ascii[at++] = 91;
  for (let index = 0; index < bytes.length; index++) {
    const value = bytes[index] ?? 0;
    if (index > 0) ascii[at++] = 44;
    if (value >= 100) ascii[at++] = 48 + Math.floor(value / 100);
    if (value >= 10) ascii[at++] = 48 + Math.floor(value / 10) % 10;
    ascii[at++] = 48 + value % 10;
  }
  ascii[at++] = 93;
  return new TextDecoder().decode(ascii.subarray(0, at));
}
