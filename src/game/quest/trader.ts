import { QuestTraderSchema } from '@wildshard/format/namedJsonContracts';
import * as v from 'valibot';
import { Vector3, type Object3D } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { ownSceneTree, sceneObjectOwner } from '@wildshard/engine/app/sceneOwnership';
import { modelContext, type ModelDef } from '@wildshard/engine/models/model';
import { place as placeModel } from '@wildshard/engine/models/place';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { QuestPageInteractionsData } from '@wildshard/format/questInteractions';
import { bindQuestPageInteractions } from '../plugin/ui';
import { bindBorrowedMethod } from '../plugin/borrowed';

const finite = v.pipe(v.number(), v.finite());
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
/** The model's original motion owner, called with its receiver intact. */
export interface TraderRig {
  readonly model: TraderFigure;
  readonly update: (dt: number, time: number, player: Vector3) => void;
  readonly dispose: () => void;
}
/** A shop attached after placement retains its original prompt readiness fence. */
export interface QuestTrader {
  readonly name: string; readonly trader: TraderFigure | null; readonly at: Vector3;
  shop: TraderShop | null; readonly open: () => void;
}
/** The page lends its original model definitions and entry owner; no model is installed by import. */
export interface QuestTraderPorts {
  readonly player: { readonly position: Vector3; yaw: number; pitch: number };
  readonly shop?: () => TraderShop;
  readonly placed?: {
    readonly scope?: Scope; readonly sky: SkyRig; readonly registry?: WorldRegistry;
    /** Existing placement, game and HUD service instances, never shard-authored policy callbacks. */
    readonly owners: ReadonlyMap<string, unknown>;
    readonly models: ReadonlyMap<string, { readonly model: ModelDef<object>; readonly name: string; readonly solidFloor?: boolean }>;
    readonly figures: ReadonlyMap<string, (object: Object3D) => TraderRig | null>;
    readonly page: { readonly rows: QuestPageInteractionsData; readonly flags: Flags; readonly prompts: Interactable[] };
  };
}
/** Driftwood's placed stall and Pine's talk-opened shop share the opening owner, with their authored view policies.
 * Placed pieces and NPC motion leave with the original entry; borrowed panels retain their existing panelHold lifetime. */
export function installQuestTrader(input: unknown, ports: QuestTraderPorts): QuestTrader | null {
  const row = parseQuestTrader(input), placed = ports.placed;
  if ((row.placement === undefined) !== (placed === undefined) || (row.view !== undefined && placed === undefined)) throw new Error('Trader placement ports do not match its declaration');
  let rig: TraderRig | null = null;
  const at = new Vector3();
  if (row.placement !== undefined && placed !== undefined) {
    const resolvePlace = bindBorrowedMethod(placed.owners, { owner: 'placement', path: ['place'] });
    const floorAt = bindBorrowedMethod(placed.owners, { owner: 'placement', path: ['floorAt'] });
    const p = row.placement, feet = v.parse(v.strictObject({ x: finite, y: finite, z: finite, yaw: finite }), resolvePlace(p.feet)), fx = Math.sin(feet.yaw), fz = Math.cos(feet.yaw);
    const ctx = modelContext(placed.sky), scope = placed.scope;
    const make = (id: string, x: number, y: number, z: number): Object3D => {
      const model = placed.models.get(id);
      if (model === undefined) throw new Error(`Missing declared trader model ${id}`);
      const build = () => placeModel(model.model, [{ x, y, z, yaw: feet.yaw }], { ctx, draw: 'single', ...(placed.registry === undefined ? {} : { registry: placed.registry }),
        piece: { id, name: model.name, ...(model.solidFloor === undefined ? {} : { solidFloor: model.solidFloor }) } });
      const made = scope === undefined ? build() : scope.run(build);
      if (scope !== undefined) {
        const owner = sceneObjectOwner(made.object);
        if (owner === null || owner === (made.object.parent === null ? null : sceneObjectOwner(made.object.parent))) ownSceneTree(made.object, scope, app.assets);
      }
      return made.object;
    };
    const npc = make(p.npc, feet.x, feet.y, feet.z), cx = feet.x + fx * p.counterAhead, cz = feet.z + fz * p.counterAhead;
    const counter = make(p.counter, cx, v.parse(finite, floorAt(cx, cz)), cz);
    rig = placed.figures.get(p.npc)?.(npc) ?? null;
    if (rig === null) return null;
    const live = rig;
    scope?.onDispose(() => { live.dispose(); });
    live.model.companions.push(counter);
    const ax = feet.x + fx * p.tradeAhead, az = feet.z + fz * p.tradeAhead;
    at.set(ax, v.parse(finite, floorAt(ax, az)) + p.tradeHeight, az);
  }
  let pitchBefore = 0, wasOpen = false;
  const stall: QuestTrader = { name: row.name, trader: rig?.model ?? null, at, shop: null, open: () => {
    const shop = ports.shop?.() ?? stall.shop;
    if (shop === null || (!row.reopen && shop.isOpen)) return;
    if (row.view !== undefined) {
      const her = stall.trader?.position;
      if (her === undefined) throw new Error('Trader view requires its placed figure');
      const p = ports.player.position;
      ports.player.yaw = Math.atan2(-(her.x - p.x), -(her.z - p.z));
      pitchBefore = ports.player.pitch; ports.player.pitch = row.view.pitch;
    }
    shop.open(); stall.trader?.offer(); wasOpen = true;
  } };
  if (placed !== undefined && row.placement !== undefined) {
    const { page } = placed;
    const toast = bindBorrowedMethod(placed.owners, { owner: 'hud', path: ['toast'] });
    const onUpdate = bindBorrowedMethod(placed.owners, { owner: 'game', path: ['onUpdate'] });
    bindQuestPageInteractions(page.rows, { flags: page.flags, promptIds: ['trade'], interactables: page.prompts, toast: message => { toast(message); },
      owners: new Map<string, unknown>([['shop', { at, get ready() { return stall.shop !== null; }, get open() { return stall.shop?.isOpen === true; } }], ['commands', { trade: stall.open }]]) });
    onUpdate((dt: number, time: number) => {
      rig?.update(dt, time, ports.player.position);
      if (row.view === undefined) return;
      if (stall.shop?.isOpen === true && ports.player.position.distanceTo(at) > row.view.closeDistance) stall.shop.close();
      if (wasOpen && stall.shop?.isOpen !== true) { wasOpen = false; ports.player.pitch = pitchBefore; }
    }, row.placement.system);
  }
  return stall;
}
