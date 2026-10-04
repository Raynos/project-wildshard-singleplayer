/** Distance from a cell-local point to one axis-aligned tile, used by the shared 150 m refinement disc. */
export function tileDistance(x: number, z: number, tileX: number, tileZ: number, size: number): number {
  const minX = -250 + tileX * size, minZ = -250 + tileZ * size;
  return Math.hypot(Math.max(minX - x, 0, x - minX - size), Math.max(minZ - z, 0, z - minZ - size));
}
/** Only intersecting fine tiles refine; each coarse tile masks the exact quadrants replaced by resident fine geometry. */
export function terrainResidency(x: number, z: number): { fine: ReadonlySet<string>; masks: ReadonlyMap<string, ReadonlySet<number>>; shadows: ReadonlySet<string> } {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Invalid residency position');
  const fine = new Set<string>(), shadows = new Set<string>(), masks = new Map<string, Set<number>>();
  for (let tz = 0; tz < 8; tz++) for (let tx = 0; tx < 8; tx++) {
    if (tileDistance(x, z, tx, tz, 62.5) > 150) continue;
    const key = `0/${tx}/${tz}`; fine.add(key);
    const coarse = `1/${Math.floor(tx / 2)}/${Math.floor(tz / 2)}`, mask = masks.get(coarse) ?? new Set<number>();
    mask.add(tx % 2 + tz % 2 * 2); masks.set(coarse, mask);
    if (tileDistance(x, z, tx, tz, 62.5) <= 80) shadows.add(key);
  }
  return { fine, masks, shadows };
}
