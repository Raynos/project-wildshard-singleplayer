import { Group } from 'three';
import { BoxCollider, type BoxColliderData } from '@wildshard/sdk/physics';
import { readScene } from '@wildshard/sdk/scene';
import { DECK } from '../data/decks';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';

const { datum: Y0, square: PLAZA, stair: STAIR, street: STREET, well: WELL, rim: RIM, balustrade } = NINE_FLOOR_PLAN;
const STAIR_TOP = { x1: STAIR.x1 + 8, y: Y0 + STAIR.rise };
const LANDING = 4, RISE = STAIR.rise / 60, RUN = (STAIR.x1 - STAIR.x0 - 2 * LANDING) / 60;

function span(name: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): BoxCollider {
  const box = new BoxCollider(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 'stone');
  box.name = name;
  box.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return box;
}

/** Static floor boxes and the separately owned safety cap; the existing three tread flights stay native. */
export function floorBoxScene(): Group {
  const scene = new Group(); scene.name = 'nine.floor-boxes';
  const street = new Group(); street.name = 'street';
  street.add(span('street.slab', STREET.x0, Y0 - DECK.slab, NINE_FLOOR_PLAN.fronts.streetEnd - 1, STREET.x1, Y0, PLAZA.z0));
  const top = new Group(); top.name = 'stairTop';
  top.add(span('stairTop.slab', STAIR.x1, STAIR_TOP.y - DECK.slab, STAIR.z0, STAIR_TOP.x1, STAIR_TOP.y, STAIR.z1));
  const well = new Group(); well.name = 'well';
  well.add(
    span('well.ledge', WELL.x0, Y0 - 0.7, RIM.z0, WELL.x1, Y0, WELL.z1),
    span('well.stone', WELL.x0, Y0, RIM.z0 - 0.25, WELL.x1, Y0 + 1.12, RIM.z0 + 0.35),
    span('well.parapet', WELL.x0, Y0 + 1.12, RIM.z0 - 0.1, WELL.x1, Y0 + 3.2, RIM.z0 + 0.1),
    span('well.west-wall', WELL.x0 - 1, Y0, RIM.z0 - 0.25, WELL.x0, Y0 + 40, WELL.z1),
    span('well.back-wall', WELL.x0, Y0, WELL.z1, WELL.x1, Y0 + 40, WELL.z1 + 1),
  );
  const landings = new Group(); landings.name = 'stairLandings';
  for (const i of [0, 1]) {
    const flightStart = STAIR.x0 + i * (20 * RUN + LANDING), x0 = flightStart + 20 * RUN;
    const x1 = x0 + LANDING, y = Y0 + (i + 1) * 20 * RISE;
    // Full dimensions/centre preserve the native landing's exact half extents, including its 0.6 m slab.
    const box = new BoxCollider(x1 - x0, 1.2, STAIR.z1 - STAIR.z0, 'stone');
    box.name = `stairLandings.${i}`;
    box.position.set((x0 + x1) / 2, y - 0.6, (STAIR.z0 + STAIR.z1) / 2);
    landings.add(box);
  }
  const guard = new Group(); guard.name = 'guard';
  guard.add(
    span('guard.well-cap', WELL.x0, Y0 + 3.2, RIM.z0 - 0.1, WELL.x1, Y0 + balustrade.parapet, RIM.z0 + 0.1),
    span('guard.square-cap', PLAZA.x0 - 0.1, Y0 + 1.12, balustrade.guardZ0, PLAZA.x0 + 0.1, Y0 + balustrade.parapet, RIM.z0),
  );
  scene.add(street, top, well, landings, guard);
  return scene;
}

/** Compile exact box descriptors, retaining the original native groups and their order. */
export function floorBoxRows(): Record<'street' | 'stairTop' | 'well' | 'stairLandings' | 'guard', BoxColliderData[]> {
  const scene = floorBoxScene(), compiled = readScene(scene);
  const byId = new Map(compiled.colliders.map(row => [row.id, row.shape]));
  const shapes = (name: string): BoxColliderData[] => {
    const group = scene.children.find(child => child.name === name);
    if (group === undefined) throw new Error(`Missing floor group ${name}`);
    return group.children.map(child => {
      const shape = byId.get(child.name);
      if (shape?.kind !== 'box') throw new Error(`Missing floor box ${child.name}`);
      return shape;
    });
  };
  return { street: shapes('street'), stairTop: shapes('stairTop'), well: shapes('well'), stairLandings: shapes('stairLandings'), guard: shapes('guard') };
}
