/** DL21: the scene tiles the spawn-view fence attaches before control, as the build sees them. The fence (game
 * `controlRefinement.ts`, `SPAWN_VIEW_M`) awaits every spatial job within this 3-D radius of the spawn, in every direction
 * (DL17, G1000), so a tiled scene library's file with any chunk in reach is control IO, even when the library is `late`. */
export const SPAWN_VIEW_REACH_M = 221;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const point = (value: unknown): value is number[] => Array.isArray(value) && value.length >= 3 && value.every(n => typeof n === 'number' && Number.isFinite(n));
/** The files of `world/scenes` library tiles with a chunk sphere within `reach` of `world/spawn`'s point (none without a
 *  spawn). A sphere is `[x, y, z, radius]`; a chunk counts when its nearest surface point is in reach. */
export function spawnViewSceneFiles(sections: ReadonlyMap<string, unknown>, reach: number = SPAWN_VIEW_REACH_M): ReadonlySet<string> {
  const spawnSection = sections.get('world/spawn'), spawn = object(spawnSection) ? spawnSection['spawn'] : undefined;
  if (!object(spawn) || typeof spawn['x'] !== 'number' || typeof spawn['z'] !== 'number') return new Set();
  const at = [spawn['x'], typeof spawn['y'] === 'number' ? spawn['y'] : 0, spawn['z']], files = new Set<string>();
  const scenes = sections.get('world/scenes'), libraries = object(scenes) && Array.isArray(scenes['libraries']) ? scenes['libraries'] : [];
  for (const library of libraries) {
    const tiles = object(library) && Array.isArray(library['tiles']) ? library['tiles'] : [];
    for (const tile of tiles) for (const file of object(tile) && Array.isArray(tile['files']) ? tile['files'] : []) {
      if (!object(file) || typeof file['file'] !== 'string' || !Array.isArray(file['chunks'])) continue;
      const near = file['chunks'].some(chunk => {
        const sphere = object(chunk) ? chunk['sphere'] : undefined;
        return point(sphere) && Math.hypot((sphere[0] ?? 0) - (at[0] ?? 0), (sphere[1] ?? 0) - (at[1] ?? 0), (sphere[2] ?? 0) - (at[2] ?? 0)) - (sphere[3] ?? 0) <= reach;
      });
      if (near) files.add(file['file']);
    }
  }
  return files;
}
