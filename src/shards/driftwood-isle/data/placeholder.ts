/**
 * Driftwood Isle's steer for its generated far / near placeholders (G348: declared here as data, read by the generic bakes,
 * which admit it with `@wildshard/format/placeholderSource`; no per-shard table outside this folder).
 */
export const PLACEHOLDER = {
  ground: { generator: 'generators/groundRows.ts', export: 'driftwoodGroundBytes' },
  far: { look: { module: 'look/far.ts', export: 'farLook' } },
  // the palms keep their trunks in the near tier: at the cell's common ratio (~30 of ~400 triangles) a palm was its
  // crown alone; 120 keeps ~94 % of its surface (sp-o37)
  near: { floors: [{ prototype: 'driftwood-isle/palm', triangles: 120 }] },
} as const;
