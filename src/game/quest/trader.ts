import type { ShardContext } from '../plugin/context';
import { FigureRows } from '../systems/npc/figureRows';
import { QuestTraderSchema } from '@wildshard/format/namedJsonContracts';
import * as v from 'valibot';
import { Vector3, type Object3D } from 'three';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';

/** Immutable trader placement and view policy; stock and payments stay with the existing shop. */
export type QuestTraderRows = v.InferOutput<typeof QuestTraderSchema>;
/** Validate admitted rows before placing a model or changing a camera. */
export function parseQuestTrader(input: unknown): QuestTraderRows { return v.parse(QuestTraderSchema, input); }
/** The actual shop owner; the binding never creates a second inventory or save. */
export interface TraderShop { open: () => void; close: () => void; readonly isOpen: boolean }
/** Existing NPC motion and culling owners lent by the model registry. */
export interface TraderFigure {
  readonly position: Vector3; readonly companions: Object3D[]; offer: () => void;
}
/** Presentation handles borrow the existing shop and entered figure. */
export interface QuestTrader {
  readonly name: string; readonly trader: TraderFigure | null; readonly at: Vector3;
  shop: TraderShop | null; readonly open: () => void;
}
/** Native page services only; authored placement and view policy arrive as rows. */
export interface QuestTraderContext extends Pick<ShardContext, 'scope' | 'system'> {
  readonly game: { readonly runtime?: {
    readonly world: { readonly registry: Pick<WorldRegistry, 'get'>; readonly player: { readonly position: Vector3; yaw: number; pitch: number } } | null;
    readonly play: object | null;
    readonly interactables: Interactable[];
  } };
}
/** A placed shop names already-entered resources; a talk-opened shop omits them. */
export interface QuestTraderResources {
  readonly figure: string; readonly counter: string; readonly offer: string;
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
  readonly prompt: { readonly label: string; readonly radius: number };
  readonly before: readonly string[];
}
/** Client-only trader binding shared by talk-opened and placed shops. Models,
 * panels, inventory and saves stay with their original entered owners. */
export function installQuestTrader(ctx: QuestTraderContext, input: unknown, resources?: QuestTraderResources): QuestTrader {
  const row = parseQuestTrader(input), world = ctx.game.runtime?.world, play = ctx.game.runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null || ctx.scope.disposed) throw new Error('Trader requires its entered world');
  if ((row.placement === undefined) !== (resources === undefined) || (row.view !== undefined && resources === undefined)) throw new Error('Trader resources do not match its declaration');
  if (resources !== undefined && (!Number.isFinite(resources.prompt.radius) || resources.prompt.radius < 0 || resources.prompt.radius > 100)) throw new Error('Invalid trader prompt radius');
  const figure = resources === undefined ? null : FigureRows.entered(ctx.scope, resources.figure);
  if (resources !== undefined && world.registry.get(resources.counter) === undefined) throw new Error('Missing trader counter piece');
  const player = world.player, at = resources === undefined ? new Vector3() : new Vector3(resources.at.x, resources.at.y, resources.at.z);
  let pitchBefore = 0, wasOpen = false;
  const stall: QuestTrader = { name: row.name, trader: figure === null || resources === undefined ? null : {
    position: figure.group.position, companions: [], offer: () => { figure.signal(resources.offer); } }, at, shop: null,
    open: () => {
      if (ctx.scope.disposed) return;
      const shop = stall.shop;
      if (shop === null || (!row.reopen && shop.isOpen)) return;
      if (row.view !== undefined) {
        const her = stall.trader?.position;
        if (her === undefined) throw new Error('Trader view requires its entered figure');
        const p = player.position;
        player.yaw = Math.atan2(-(her.x - p.x), -(her.z - p.z)); pitchBefore = player.pitch; player.pitch = row.view.pitch;
      }
      shop.open(); stall.trader?.offer(); wasOpen = true;
    } };
  if (resources !== undefined && row.placement !== undefined) {
    const prompts = ctx.game.runtime?.interactables;
    if (prompts === undefined) throw new Error('Missing trader prompt owner');
    const prompt: Interactable = { position: at, label: resources.prompt.label,
      get radius() { return stall.shop !== null && !stall.shop.isOpen ? resources.prompt.radius : 0; }, onInteract: stall.open };
    prompts.push(prompt); ctx.scope.onDispose(() => { const i = prompts.indexOf(prompt); if (i !== -1) prompts.splice(i, 1); });
    ctx.system({ id: row.placement.system, phase: 'update', before: [...resources.before], run: () => {
      if (ctx.scope.disposed || row.view === undefined) return;
      if (stall.shop?.isOpen === true && player.position.distanceTo(at) > row.view.closeDistance) stall.shop.close();
      if (wasOpen && stall.shop?.isOpen !== true) { wasOpen = false; player.pitch = pitchBefore; }
    } });
  }
  return stall;
}
