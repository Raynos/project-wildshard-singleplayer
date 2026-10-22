/**
 * A quest page's placed kit figures (G571, `quest.composition` `figures.file`), installed by the composition host after
 * its one prepare and before install. Each row builds the original `KitFigure` from its admitted kit and catalogue
 * rows: the part geometry copied from the page's fixed-draw owner, its extra objects (an unlit flame mesh; a building
 * cloud that stays hidden on an empty draw until both its geometry and its lent look exist, never owning that look),
 * its publications, placed at its composition place and turned to its yaw. The camp part (campAt 'fire') and an
 * object at 'fire' sit at the fire turned into the figure's frame (the inverse yaw of fire - feet, height included),
 * exactly as Driftwood's castaway camp did. A trader row's piece, card and counter stay with the composition's
 * placed-model owners (installQuestFigures). Systems run in row order; the page scope disposes every figure.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import { KitFigureCardsSchema, QuestFiguresSchema, type QuestFigureRows } from '@wildshard/format/questFigures';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { KitFigure } from '../systems/npc/kitFigure';
import { createBuildingCloud } from '../shardfile/buildingCloud';
import { SceneHandles } from '../shardfile/sceneHandles';
import { hasLentLook, lentLook } from '../shardfile/lentLooks';
import { defineModel, sharedModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { place as placeModel } from '@wildshard/engine/models/place';
import type { ShardContext } from '../plugin/context';
import { FigureRows } from '../systems/npc/figureRows';
import { ownQuestTree } from './chapter';

interface Place { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
/** What the composition host lends the installer: its one placement, the page's scene resources, the fixed-draw owner,
 *  the admitted figure catalogue and the product's client channels (the figures' attention programs). */
export interface QuestFigurePorts {
  readonly sky: SkyRig;
  readonly scope?: Scope;
  readonly resources: SceneHandles;
  readonly place: (at: QuestFigureRows['feet']) => Place;
  readonly draws: { readonly ready: boolean; handle: (slot: string) => { copy: () => THREE.BufferGeometry } };
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
    const g = ports.draws.handle(slot).copy(); if (part === 'camp' && row.campAt === 'fire') g.translate(local.x, local.y, local.z); return [part, g];
  }));
  const objects = new Map<string, THREE.Object3D>();
  for (const object of row.objects) {
    const o = offset(object.at);
    if (object.kind === 'basic-mesh') {
      const material = new THREE.MeshBasicMaterial({ vertexColors: object.vertexColors, color: new THREE.Color(...object.colour) });
      material.name = object.name;
      const mesh = new THREE.Mesh(ports.draws.handle(object.draw).copy(), material);
      mesh.position.set(o.x, o.y + object.lift, o.z); objects.set(object.id, mesh);
    } else {
      const ready = ports.draws.ready, lit = hasLentLook(object.look);
      objects.set(object.id, createBuildingCloud(ports.resources, {
        geometry: ports.resources.lend(ready ? ports.draws.handle(object.draw).copy() : new THREE.BufferGeometry()),
        material: lit ? ports.resources.lend(lentLook(object.look)) : null, seeds: object.seeds, name: object.name,
        at: [o.x, o.y, o.z], center: object.center, radius: object.radius, order: object.order, visible: lit && ready }));
    }
  }
  for (const publication of row.publish) ports.resources.publish(publication.id, ports.draws.handle(publication.draw).copy());
  const figure = new KitFigure(ports.sky, row.kit, ports.catalogue.rows(row.kit), ports.catalogue.kit(row.kit),
    { geometry, objects, channels: ports.channels }, ports.resources, ports.scope);
  figure.group.position.set(feet.x, feet.y, feet.z); figure.group.rotation.y = yaw;
  return figure;
}

/** What a page lends installQuestFigures: its prepared placement (places and floor), scene resources, fixed draws and
 *  figure catalogue, and the catalogue whose models a trader row names (its card and counter). */
export interface QuestFigureInstall extends Pick<QuestFigurePorts, 'resources' | 'draws' | 'catalogue'> {
  readonly placement: { place: QuestFigurePorts['place']; floorAt: (x: number, z: number) => number };
  readonly models: { model: (name: string) => ModelDef<Record<string, unknown>> };
}

/** Install the admitted figures file on the page: each figure live in the page scope, a trader row placed as its registry
 *  piece (its card the Explorer specimen, its catalogue rows' colliders) with its counter `ahead` metres in front of its
 *  feet on the floor, each figure posed by its row's system before that row's systems. */
export function installQuestFigures(ctx: ShardContext, input: unknown, ports: QuestFigureInstall): readonly KitFigure[] {
  const rows = v.parse(QuestFiguresSchema, input).figures, world = ctx.game.runtime?.world;
  if (world === undefined || world === null || ctx.scope.disposed || ctx.scope.disposing) throw new Error('Quest figures require their entered world');
  // Check all placed-model descriptors before the first figure is constructed.
  const models = new Map(rows.flatMap(row => {
    const placed = row.card !== undefined || row.piece !== undefined || row.name !== undefined || row.counter !== undefined;
    if (!placed) return [];
    if (row.card === undefined || row.piece === undefined || row.name === undefined || row.counter === undefined || row.fire !== undefined)
      throw new Error('Placed quest figure requires its card, piece, name and counter');
    return [[row.id, { card: ports.models.model(row.card), counter: ports.models.model(row.counter.model) }] as const];
  }));
  const common: QuestFigurePorts = { ...ports, place: at => ports.placement.place(at), sky: world.sky, scope: ctx.scope, channels: ctx.product.shardfile.clientChannels };
  const figures: { readonly row: QuestFigureRows; readonly figure: KitFigure }[] = [];
  // Keep the original cleanup order (speaker then trader). FigureRows owns
  // publications; borrowed looks stay borrowed.
  const dispose = (): void => { for (const { figure } of figures) figure.dispose(); };
  try { ctx.scope.run(() => {
    for (const row of rows) {
      const cards = models.get(row.id);
      if (cards === undefined) { figures.push({ row, figure: questFigure(row, common) }); continue; }
      const counterRow = row.counter;
      if (counterRow === undefined || row.piece === undefined || row.name === undefined) throw new Error('Missing admitted figure placement');
      const byGroup = new WeakMap<THREE.Object3D, KitFigure>();
      const model = defineModel({ ...cards.card, specimen: cards.card.build,
        build: () => {
          // placeModel applies feet once. The original trader builder is at its
          // origin and uses its own publication namespace, unlike the speaker.
          const figure = questFigure(row, { ...common, resources: new SceneHandles(world.sky), place: () => ({ x: 0, y: 0, z: 0, yaw: 0 }) });
          byGroup.set(figure.group, figure); return figure.group;
        }, colliders: () => FigureRows.collidersFor(ports.catalogue.rows(row.kit)) });
      const feet = ports.placement.place(row.feet), context = { ...sharedModelContext(world.sky), specimenScope: ctx.scope };
      const placed = placeModel(model, [feet], { ctx: context, draw: 'single', registry: world.registry, piece: { id: row.piece, name: row.name } });
      const figure = byGroup.get(placed.object);
      if (figure === undefined) throw new Error('Missing entered quest figure');
      figures.push({ row, figure });
      const x = feet.x + Math.sin(feet.yaw) * counterRow.ahead, z = feet.z + Math.cos(feet.yaw) * counterRow.ahead;
      const counter = placeModel(cards.counter, [{ x, y: ports.placement.floorAt(x, z), z, yaw: feet.yaw }],
        { ctx: context, draw: 'single', registry: world.registry, piece: { id: counterRow.piece, name: counterRow.name, solidFloor: counterRow.solidFloor } });
      ownQuestTree(placed.object, ctx.scope); ownQuestTree(counter.object, ctx.scope);
      figure.companions.push(counter.object);
    }
  }); } catch (error) { dispose(); throw error; }
  ctx.scope.onDispose(dispose);
  for (const { row, figure } of figures) ctx.system({ id: row.system.id, phase: 'update', before: [...row.system.before],
    run: (dt, time) => { figure.update(dt, time, world.player.position); } });
  return figures.map(({ figure }) => figure);
}

/** What cold Explorer kit cards borrow once their shard's roster has loaded its fixed draws: those draws, its figure
 *  catalogue and the product's client channels. */
export type KitFigureCardPorts = Pick<QuestFigurePorts, 'draws' | 'catalogue' | 'channels'>;

/** The admitted kit figure cards as Explorer models by key: each the live figure from its own row, built in its own space
 *  (its row's places taken as figure-frame coordinates) with its own scene resources. */
export function kitFigureCards(input: unknown, ports: KitFigureCardPorts): (key: string) => ModelDef<object> {
  const cards = new Map(Object.entries(v.parse(KitFigureCardsSchema, input).cards).map(([key, { model: { surface, ...model }, ...card }]) => [key, defineModel<object>({
    ...model, ...(surface === undefined ? {} : { surface }),
    build: ctx => questFigure(card.figure, { sky: ctx.sky, resources: new SceneHandles(ctx.sky), draws: ports.draws, catalogue: ports.catalogue,
      channels: ports.channels, place: at => ({ x: at.x, y: at.y ?? 0, z: at.z, yaw: at.yaw ?? 0 }) }).group,
  })]));
  return key => { const card = cards.get(key); if (card === undefined) throw new Error(`Missing kit figure card: ${key}`); return card; };
}
