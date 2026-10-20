import { arenaRoomBrain } from '@wildshard/game/boss/arenaRoom';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesDef,ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { Vector3 } from 'three';
import speciesRows from './speciesRows.json' with { type:'json' };
import { animateGoldenKing } from './presentation';

export const GOLDEN_KING = speciesRows.king.kind;
export interface GoldenKingPorts {
  think: (a: Animal, c: ThinkCtx) => void; act: (a: Animal, c: ThinkCtx) => void;
  damageMul: (a: Animal, point: Vector3, direction: Vector3) => number;
}
const kingBrains = new WeakMap<Animal, GoldenKingPorts>();
export function bindGoldenKing(a: Animal, ports: GoldenKingPorts): void { kingBrains.set(a, ports); }
/** The Golden King's page controls; his body, rig, look and tick are the look book's rows. */
export const GOLDENKING_SPECIES: Pick<SpeciesDef, 'kind' | 'animate' | 'think' | 'act' | 'damageMul'> = {
  kind: GOLDEN_KING, animate: animateGoldenKing,
  think: (a, c) => {
    const m = a.mem;
    if (m['init'] !== 1) { m['init'] = 1; m['pose'] ??= 0; m['rise'] ??= 0; m['cape'] ??= 1; m['crown'] ??= 1; m['floorY'] ??= c.heightAt(a.position.x, a.position.z); }
    (kingBrains.get(a) ?? arenaRoomBrain(a))?.think(a, c);
  },
  act: (a, c) => { (kingBrains.get(a) ?? arenaRoomBrain(a))?.act(a, c); },
  damageMul: (a, point, direction) => (kingBrains.get(a) ?? arenaRoomBrain(a))?.damageMul(a, point, direction) ?? 1,
};


