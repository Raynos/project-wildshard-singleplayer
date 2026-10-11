import { Group } from 'three';
import { BoxCollider, type BoxColliderData } from '@wildshard/sdk/physics';
import { readScene } from '@wildshard/sdk/scene';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';

const { datum: Y0, square: PLAZA, stair: STAIR, street: STREET, well: WELL, fronts } = NINE_FLOOR_PLAN;
const { streetEnd: STREET_END, wallHeight: WALL_H, depth: DEEP, shop: SHOP } = fronts;
const STAIR_TOP = { x1: STAIR.x1 + 8, y: Y0 + STAIR.rise };

function span(name: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): BoxCollider {
  const box = new BoxCollider(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 'stone');
  box.name = name;
  box.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return box;
}

/** The ten solid building fronts, authored without loading a page, model or physics service. */
export function frontScene(): Group {
  const scene = new Group(); scene.name = 'nds-fronts';
  const streetEnd = STREET_END - 1;
  const top = Y0 + WALL_H;
  scene.add(span('square-east-north', PLAZA.x1 + 0.6 - SHOP, Y0, PLAZA.z0 - 0.6, PLAZA.x1 + DEEP, top, STAIR.z0));            // east, north of the stair
  scene.add(span('square-east-south', PLAZA.x1 + 0.6 - SHOP, Y0, STAIR.z1, PLAZA.x1 + DEEP, top, PLAZA.z1 + DEEP));            // east, south of the stair
  scene.add(span('square-north', STREET.x1, Y0, PLAZA.z0 - DEEP, PLAZA.x1 + DEEP, top, PLAZA.z0 - 0.6 + SHOP));           // north, right of the gate
  scene.add(span('square-south', PLAZA.x0 - 0.6, Y0, PLAZA.z1 + 0.6 - SHOP, PLAZA.x1 + DEEP, top, PLAZA.z1 + DEEP));      // south, behind the spawn
  // ── the street's walls (shopfronts both sides) and its end ──
  scene.add(span('street-west', STREET.x0 - DEEP, Y0, streetEnd, STREET.x0 + SHOP, top, WELL.z0));                      // west, past the Well
  scene.add(span('street-east', STREET.x1 - SHOP, Y0, streetEnd, STREET.x1 + DEEP, top, PLAZA.z0 - 0.6));                // east
  scene.add(span('street-end', STREET.x0, Y0, STREET_END - 2, STREET.x1, top, STREET_END - 1));                       // the fragment's end
  // ── the stair-street's walls and its top ──
  scene.add(span('stair-north', PLAZA.x1 + 0.6, Y0 - 1, STAIR.z0 - DEEP, STAIR_TOP.x1, STAIR_TOP.y + WALL_H, STAIR.z0));
  scene.add(span('stair-south', PLAZA.x1 + 0.6, Y0 - 1, STAIR.z1, STAIR_TOP.x1, STAIR_TOP.y + WALL_H, STAIR.z1 + DEEP));
  scene.add(span('stair-end', STAIR_TOP.x1, Y0 - 1, STAIR.z0 - DEEP, STAIR_TOP.x1 + DEEP, STAIR_TOP.y + WALL_H, STAIR.z1 + DEEP));
  return scene;
}

/** Compile the scene into the existing front piece's exact ordered box descriptors. */
export function frontRows(): BoxColliderData[] {
  return readScene(frontScene()).colliders.map(row => {
    if (row.shape.kind !== 'box') throw new Error(`Invalid front collider ${row.id}`);
    return row.shape;
  });
}
