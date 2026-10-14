/** Authored terrain/native floor profile; the original lattice is column-major and clamps at the cell edge. */
export const DRIFTWOOD_TERRAIN = { key: 'driftwood-isle', seed: 0x5ea1, res: 256, size: 500,
  sampling: { layout: 'column-major' as const, boundary: 'clamp' as const } };
