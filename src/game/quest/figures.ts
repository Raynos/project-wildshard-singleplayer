/**
 * A quest page's placed kit figures (G571, `quest.composition` `figures.file`), installed by the composition host after
 * its one prepare and before install. Each row builds the original `KitFigure` from its admitted kit and catalogue
 * rows: the part geometry copied from the page's fixed-draw owner, its extra objects (an unlit flame mesh; a building
 * cloud that stays hidden on an empty draw until both its geometry and its lent look exist, never owning that look),
 * its publications, placed at its composition place and turned to its yaw. The camp part (campAt 'fire') and an
 * object at 'fire' sit at the fire turned into the figure's frame (the inverse yaw of fire - feet, height included),
 * exactly as Driftwood's castaway camp did. A trader row's piece, card and counter stay with the composition's
 * placed-model owners. Systems run in row order; the page scope disposes every figure.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import { QuestFiguresSchema, type QuestFigureRows } from '@wildshard/format/questFigures';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { KitFigure } from '../systems/npc/kitFigure';
import { createBuildingCloud } from '../shardfile/buildingCloud';
import type { SceneHandles } from '../shardfile/sceneHandles';
import { hasLentLook, lentLook } from '../shardfile/lentLooks';

interface Place { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
/** What the composition host lends the installer: its one placement, the page's scene resources, the fixed-draw owner,
 *  the admitted figure catalogue and the product's client channels (the figures' attention programs). */
export interface QuestFigurePorts {
  readonly sky: SkyRig;
  readonly scope: Scope;
  readonly resources: SceneHandles;
  readonly place: (at: QuestFigureRows['feet']) => Place;
  readonly draws: { readonly ready: boolean; copy: (slot: string) => THREE.BufferGeometry };
  readonly catalogue: { rows: (id: string) => unknown; kit: (id: string) => unknown };
  readonly channels: unknown;
}

/** The fire's place in the figure's frame: `fire - feet` turned by the figure's inverse yaw, its height difference kept. */
export function fireInFigureFrame(feet: Place, fire: { readonly x: number; readonly y: number; readonly z: number }): THREE.Vector3 {
  const dx = fire.x - feet.x, dz = fire.z - feet.z, c = Math.cos(-feet.yaw), s = Math.sin(-feet.yaw);
  return new THREE.Vector3(dx * c + dz * s, fire.y - feet.y, -dx * s + dz * c);
}

/** One figure from its row at its places (the castaway's camp and the trader's stall alike). */
export function questFigure(row: QuestFigureRows, ports: QuestFigurePorts): KitFigure {
  const feet = ports.place(row.feet), yaw = feet.yaw, fire = row.fire === undefined ? feet : ports.place(row.fire);
  const local = fireInFigureFrame(feet, fire);
  const offset = (at: 'feet' | 'fire'): THREE.Vector3 => at === 'fire' ? local : new THREE.Vector3();
  const geometry = new Map(Object.entries(row.parts).map(([part, slot]) => {
    const g = ports.draws.copy(slot); if (part === 'camp' && row.campAt === 'fire') g.translate(local.x, local.y, local.z); return [part, g];
  }));
  const objects = new Map<string, THREE.Object3D>();
  for (const object of row.objects) {
    const o = offset(object.at);
    if (object.kind === 'basic-mesh') {
      const material = new THREE.MeshBasicMaterial({ vertexColors: object.vertexColors, color: new THREE.Color(...object.colour) });
      material.name = object.name;
      const mesh = new THREE.Mesh(ports.draws.copy(object.draw), material);
      mesh.position.set(o.x, o.y + object.lift, o.z); objects.set(object.id, mesh);
    } else {
      const ready = ports.draws.ready, lit = hasLentLook(object.look);
      objects.set(object.id, createBuildingCloud(ports.resources, {
        geometry: ports.resources.lend(ready ? ports.draws.copy(object.draw) : new THREE.BufferGeometry()),
        material: lit ? ports.resources.lend(lentLook(object.look)) : null, seeds: object.seeds, name: object.name,
        at: [o.x, o.y, o.z], center: object.center, radius: object.radius, order: object.order, visible: lit && ready }));
    }
  }
  for (const publication of row.publish) ports.resources.publish(publication.id, ports.draws.copy(publication.draw));
  const figure = new KitFigure(ports.sky, row.kit, ports.catalogue.rows(row.kit), ports.catalogue.kit(row.kit),
    { geometry, objects, channels: ports.channels }, ports.resources, ports.scope);
  figure.group.position.set(feet.x, feet.y, feet.z); figure.group.rotation.y = yaw;
  return figure;
}

/** Parse the admitted figures file; each figure built in row order. */
export function questFigures(input: unknown, ports: QuestFigurePorts): readonly { readonly row: QuestFigureRows; readonly figure: KitFigure }[] {
  return v.parse(QuestFiguresSchema, input).figures.map(row => ({ row, figure: questFigure(row, ports) }));
}
