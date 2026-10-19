/** Numeric placement rows: a bounded column dictionary followed by LE float64 cells. */
export function packDressingTable(input: unknown): Uint8Array {
  if (!Array.isArray(input) || input.length > 100_000) throw new Error('Invalid dressing table rows');
  const rows: unknown[] = input;
  const first = rows[0];
  if (typeof first !== 'object' || first === null || Array.isArray(first)) throw new Error('Missing dressing table columns');
  const keys = Object.keys(first).sort();
  if (keys.length === 0 || keys.length > 32 || keys.some(key => !/^[a-zA-Z][a-zA-Z0-9]{0,30}$/u.test(key))) throw new Error('Invalid dressing table columns');
  const header = new TextEncoder().encode(keys.join('\0'));
  const bytes = new Uint8Array(16 + header.length + rows.length * keys.length * 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x3150444e, true); view.setUint32(4, rows.length, true);
  view.setUint32(8, keys.length, true); view.setUint32(12, header.length, true);
  bytes.set(header, 16);
  rows.forEach((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row) || Object.keys(row).sort().join('\0') !== keys.join('\0')) throw new Error('Dressing table columns changed');
    const values = new Map(Object.entries(row));
    keys.forEach((key, column) => {
      const value: unknown = values.get(key);
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Dressing table needs finite numbers');
      view.setFloat64(16 + header.length + (index * keys.length + column) * 8, value, true);
    });
  });
  return bytes;
}
