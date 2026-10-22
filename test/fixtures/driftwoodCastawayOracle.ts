/** Frozen pre-declaration castaway oracle; production owns no imports from this fixture. */
/**
 * Driftwood Isle's people (E306 / E315 M5): Wendell the castaway, who gives the island's quest — a kit figure
 * (@wildshard/game/systems/npc/kitFigure on the figure catalogue's kit rows, generators/figureCatalogue.ts): the striped
 * shirt, the straw hat, the driftwood staff, and his campfire and its smoke column beside him. Not skinned: his body,
 * head and waving arm turn on pivots. The quest stands him by the hut; the card is the same build at his own origin, his
 * fire where it burns beside him. Its mesh smoke stays hidden until the entered world lends its compiled look.
 */
import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { createBuildingCloud } from '@wildshard/game/shardfile/buildingCloud';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { KitFigure } from '@wildshard/game/systems/npc/kitFigure';
import { hasLentLook, lentLook } from '@wildshard/sdk/looks/lentLooks';
import { driftwoodRows, driftwoodProduct } from './driftwoodLegacyRows';
import { fixedDraw, fixedGeometryGroups, fixedGeometryReady, FIGURES } from './driftwoodLegacyAssets';

export interface Pos { x: number; y: number; z: number; yaw?: number }

/** Wendell at `feet`, his camp moved to where its fire burns (`fire`, turned into his frame), its flames and smoke lent. */
export function castawayFigure(sky: Sky, feet: Pos, fire: Pos, resources: SceneHandles, owner?: Scope): KitFigure {
  const yaw = feet.yaw ?? 0, dx = fire.x - feet.x, dz = fire.z - feet.z, c = Math.cos(-yaw), s = Math.sin(-yaw);
  const f = new THREE.Vector3(dx * c + dz * s, fire.y - feet.y, -dx * s + dz * c), kit = fixedGeometryGroups().npc.castaway;
  const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.8, 1.8, 1.8) }); // unlit, it blooms
  flameMat.name = 'castaway-flame';
  const flames = new THREE.Mesh(fixedDraw(kit.flames).copy(), flameMat);
  flames.position.set(f.x, f.y + 0.08, f.z);
  const native = driftwoodRows('custom/fixedLayouts').nativeView, smokeRow = native.CASTAWAY_SMOKE, ready = fixedGeometryReady(), lit = hasLentLook(native.SMOKE_LOOK);
  const smoke = createBuildingCloud(resources, { geometry: resources.lend(ready ? fixedDraw('castawaySmoke').copy() : new THREE.BufferGeometry()),
    material: lit ? resources.lend(lentLook(native.SMOKE_LOOK)) : null, seeds: false, name: smokeRow.name,
    at: [f.x, f.y, f.z], center: smokeRow.bounds.offset, radius: smokeRow.bounds.radius, order: smokeRow.renderOrder, visible: lit && ready });
  resources.publish('castaway.fitted-head', fixedDraw('wendellHead').copy());
  const geometry = new Map([['body', fixedDraw(kit.body).copy()], ['camp', fixedDraw(kit.camp).copy().translate(f.x, f.y, f.z)],
    ['head', fixedDraw(kit.head).copy()], ['arm', fixedDraw(kit.arm).copy()]]);
  const objects = new Map<string, THREE.Object3D>([['flames', flames], ['smoke', smoke]]);
  const figure = new KitFigure(sky, 'castaway', FIGURES.rows('castaway'), FIGURES.kit('castaway'), { geometry, objects, channels: driftwoodProduct().shardfile.clientChannels }, resources, owner);
  figure.group.position.set(feet.x, feet.y, feet.z); figure.group.rotation.y = yaw;
  return figure;
}

