import { arenaRoomBrain } from '@wildshard/game/boss/arenaRoom';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import speciesRows from '../boot/speciesRows.generated.json' with { type:'json' };

export const GOLDEN_KING = speciesRows.king.kind;
/** The Golden King's page controls; his body, rig, look and tick are the look book's rows. */
export const GOLDENKING_SPECIES: Pick<SpeciesDef, 'kind' | 'think' | 'act' | 'damageMul'> = {
  kind: GOLDEN_KING,
  think: (a, c) => {
    const m = a.mem;
    if (m['init'] !== 1) { m['init'] = 1; m['pose'] ??= 0; m['rise'] ??= 0; m['cape'] ??= 1; m['crown'] ??= 1; m['floorY'] ??= c.heightAt(a.position.x, a.position.z); }
    arenaRoomBrain(a)?.think(a, c);
  },
  act: (a, c) => { arenaRoomBrain(a)?.act(a, c); },
  damageMul: (a, point) => arenaRoomBrain(a)?.damageMul(a, point) ?? 1,
};


