/**
 * The view half of declared movers (E6): binding a shard's rendered groups and native chains to the poses a mover
 * publishes. A page feeds these views from its own MoverRuntime; `netMoverPoses` feeds the same views off `script` rows.
 */
import * as v from 'valibot';
import type { Object3D } from 'three';
import type { World } from '@wildshard/engine/core/bootstrap';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { NetClient } from '@wildshard/engine/net/client';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import type { MoverData } from '@wildshard/format/movers';
import type { MoverInstallation, MoverRuntime, MoverView } from '../../server/plugin/mover';
import { pageSim } from '../shardfile/clientMoverOwners';

/** One authored binding of a mover to a rendered group or a native chain of the constructed world. */
export interface BorrowedMoverRow {
  readonly id: string; readonly target: string; readonly chain?: boolean; readonly group?: 'group'; readonly visibility?: 'enabled';
  readonly order?: 'XYZ'; readonly afterPose?: 'refreshPose';
}
function hasPosePresentation(target: object): target is { refreshPose: () => void } {
  return 'refreshPose' in target && typeof target.refreshPose === 'function';
}
function isRenderedGroup(value: unknown): value is Object3D {
  return typeof value === 'object' && value !== null && 'isObject3D' in value && value.isObject3D === true;
}
const identifier = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_.-]{1,128}$/u));
const Rows = v.pipe(v.array(v.strictObject({ id: identifier, target: identifier, chain: v.exactOptional(v.boolean()), group: v.exactOptional(v.literal('group')),
  visibility: v.exactOptional(v.literal('enabled')), order: v.exactOptional(v.literal('XYZ')), afterPose: v.exactOptional(v.literal('refreshPose')) })), v.maxLength(32));

/** Admit data bindings for already constructed native resources: the views each row's mover poses. */
export function borrowedMoverViews(data: MoverData, input: readonly BorrowedMoverRow[], targets: unknown): ReadonlyMap<string, MoverView> {
  const views = new Map<string, MoverView>(), rows = v.parse(Rows, input);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate borrowed mover binding');
  if (targets === null || typeof targets !== 'object') throw new Error('Missing borrowed mover targets');
  for (const row of rows) {
    if (!Object.hasOwn(targets, row.target) || !data.some(value => value.id === row.id)) throw new Error('Unbound borrowed mover target');
    const target: unknown = Reflect.get(targets, row.target);
    if (row.chain === true) {
      if (!(target instanceof RopeChain) || row.group !== undefined || row.afterPose !== undefined) throw new Error('Borrowed mover requires its native chain');
      views.set(row.id, { chain: target, pose: () => undefined });
      continue;
    }
    if (target === null || typeof target !== 'object' || row.group === undefined || !('group' in target)
      || !isRenderedGroup(target.group)) throw new Error('Borrowed mover requires its rendered group');
    const group = target.group;
    if (row.afterPose !== undefined && !hasPosePresentation(target)) throw new Error('Missing borrowed pose presentation');
    group.userData['declaredMotion'] = true;
    views.set(row.id, { pose: pose => {
      if (row.visibility === 'enabled') group.visible = pose.enabled;
      group.position.set(pose.position.x, pose.position.y, pose.position.z);
      group.rotation.set(pose.euler.x, pose.euler.y, pose.euler.z, row.order ?? 'YXZ');
      if (row.afterPose !== undefined && hasPosePresentation(target)) target.refreshPose();
    } });
  }
  return views;
}

/** Admit data bindings for already constructed native resources (formerly `MoverRuntime.enter`). The caller
 * lends actual flags/prompts/assets; the page's mover host retains the fixed-step owner. */
export function enterMovers(ctx: LevelContext, world: World, data: MoverData,
    rows: { readonly systemId: string; readonly bindings: readonly BorrowedMoverRow[] }, targets: unknown,
    ports: Pick<MoverInstallation, 'flags' | 'prompts' | 'admitted' | 'read'> = {}): Promise<MoverRuntime> {
  v.parse(v.strictObject({ systemId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), bindings: v.unknown() }), rows);
  return pageSim.installDeclaredMovers(ctx, world, { ...ports, data, modules: new Map(), systemId: rows.systemId, views: borrowedMoverViews(data, rows.bindings, targets) });
}

/** The same views off the wire: every `script` row the client holds poses the mover of that id. Run once a frame. */
export function netMoverPoses(client: NetClient, views: ReadonlyMap<string, MoverView>, renderTick: number): void {
  for (const [handle, info] of client.entities) {
    if (!info.id.startsWith('script:')) continue;
    const view = views.get(info.id.slice('script:'.length)), row = view === undefined ? null : client.interpolator.fields(handle, renderTick);
    if (view === undefined || row === null) continue;
    const { x, y, z, pitch, yaw, roll, enabled } = row;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || typeof pitch !== 'number' || typeof yaw !== 'number' || typeof roll !== 'number') continue;
    view.pose({ position: { x, y, z }, euler: { x: pitch, y: yaw, z: roll }, enabled: enabled === true }, {});
  }
}
