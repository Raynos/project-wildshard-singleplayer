import cabins from '../data/cabins.json' with { type: 'json' };

/** Audio surfaces and fire emitters follow the original cabin-then-hamlet build order. */
export function cabinAmbienceRows(): { floors: { x: number; z: number; rot: number; hw: number; hd: number; y: number }[]; firePits: { x: number; y: number; z: number }[] } {
  const buildings = [...cabins.buildings.filter(row => !row.hamlet), ...cabins.buildings.filter(row => row.hamlet)];
  return { floors: buildings.flatMap(row => row.floors), firePits: buildings.flatMap(row => {
    const at = row.firePit;
    if (at === null) return [];
    const [x, y, z] = at;
    if (x === undefined || y === undefined || z === undefined) throw new Error('Invalid cabin fire emitter');
    return [{ x, y, z }];
  }) };
}
