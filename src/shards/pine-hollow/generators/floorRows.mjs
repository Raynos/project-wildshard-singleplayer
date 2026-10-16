const FLOOR_KINDS = 6, MAX_FLOOR_RECORDS = 40_000;
/** Decode the existing authored binary once during authoring, retaining every quantised value. */
export function decodeFloorRecords(bytes, expectedCounts) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 32 || view.getUint32(0, true) !== 0x46555357 || view.getUint32(4, true) !== 2) throw new Error('[undergrowth] invalid floor records');
  /** @type {(string | undefined)[]} */
  const kinds = ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'];
  const counts = kinds.map((_, i) => view.getUint32(8 + i * 4, true));
  const count = counts.reduce((total, n) => total + n, 0);
  if (count > MAX_FLOOR_RECORDS || bytes.length !== 32 + count * 12 || counts.some((n, i) => n !== expectedCounts[i])) throw new Error('[undergrowth] invalid floor counts');
  const layout = { ferns: [], shrubs: [], litter: [], stones: [], moss: [], reeds: [] };
  let offset = 32;
  /** @type {(number[] | undefined)[]} */
  const tints = [[.5,.78,.72,.82,.48,.6],[.8,1,.9,.8,.6,.55],[.7,.9,.68,.82,.62,.75],[.75,1,.75,.98,.75,.95],[.6,.85,.62,.78,.5,.62],[.75,1,.85,.95,.45,.6]];
  for (let i = 0; i < FLOOR_KINDS; i++) for (let j = 0; j < Math.min(counts[i] ?? 0, MAX_FLOOR_RECORDS); j++) {
    const kind = kinds[i], tint = tints[i]; if (kind === undefined || tint === undefined) throw new Error('[undergrowth] missing kind or tint');
    const nx = view.getInt8(offset + 8) / 127, nz = view.getInt8(offset + 9) / 127, hue = view.getUint8(offset + 11) / 255;
    const mix = (a, b) => a + (b - a) * hue;
    layout[kind].push({ x: view.getUint16(offset, true) / 65535 * 500 - 250, y: view.getUint16(offset + 2, true) / 65535 * 256 - 128, z: view.getUint16(offset + 4, true) / 65535 * 500 - 250,
      nx, ny: Math.sqrt(1 - nx * nx - nz * nz), nz, rot: view.getUint16(offset + 6, true) / 65535 * (2 * Math.PI), scale: .5 + view.getUint8(offset + 10) / 200,
      r: mix(tint[0], tint[1]), g: mix(tint[2], tint[3]), b: mix(tint[4], tint[5]) });
    offset += 12;
  }
  return layout;
}

