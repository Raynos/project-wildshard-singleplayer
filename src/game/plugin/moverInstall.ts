/**
 * The client half of declared movers (P1-E1): binding a shard's rendered groups and native chains to a MoverRuntime and
 * installing it on a level. The runtime, its script host and the headless driver stay in `mover.ts`, which imports no
 * renderer class; this file owns the `Object3D` check a borrowed group passes.
 */
import { Object3D } from 'three';
import * as v from "valibot";
import type { World } from "@wildshard/engine/core/bootstrap";
import type { LevelContext } from "@wildshard/engine/level/context";
import { RopeChain } from "@wildshard/engine/physics/ropeChain";
import { scriptPhysicsQueries } from "@wildshard/engine/script/queries";
import type { MoverData } from "@wildshard/format/movers";
import type { createShardfileComposedLane } from "../shardfile/scriptComposition";
import { createComposedMoverHost, createMoverHost, MoverRuntime, type MoverInstallation } from "./mover";

/** Admit data bindings for already constructed native resources (formerly `MoverRuntime.enter`). The caller
 * lends actual flags/prompts/assets; this host retains the fixed-step owner. */
export function enterMovers(ctx: LevelContext, world: World, data: MoverData,
    rows: { readonly systemId: string; readonly bindings: NonNullable<MoverInstallation['borrowed']>['rows'] }, targets: unknown,
    ports: Pick<MoverInstallation, 'flags' | 'prompts' | 'admitted' | 'read'> = {}): Promise<MoverRuntime> {
  v.parse(v.strictObject({ systemId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), bindings: v.unknown() }), rows);
  return installDeclaredMovers(ctx, world, { ...ports, data, modules: new Map(), systemId: rows.systemId,
    borrowed: { rows: rows.bindings, targets } });
}

/** A single platform installer reads declared rows and owns their lifecycle; the shard only supplies presentation recipes. */
function hasPosePresentation(target: object): target is { refreshPose: () => void } {
  return 'refreshPose' in target && typeof target.refreshPose === 'function';
}
export async function installDeclaredMovers(ctx: LevelContext, world: World, options: MoverInstallation): Promise<MoverRuntime> {
  const views = new Map(options.views), borrowed = options.borrowed;
  if (borrowed !== undefined) {
    const identifier = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_.-]{1,128}$/u));
    const rows = v.parse(v.pipe(v.array(v.strictObject({ id: identifier, target: identifier,
      chain: v.exactOptional(v.boolean()), group: v.exactOptional(v.literal('group')), visibility: v.exactOptional(v.literal('enabled')), order: v.exactOptional(v.literal('XYZ')),
      afterPose: v.exactOptional(v.literal('refreshPose')) })), v.maxLength(32)), borrowed.rows);
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate borrowed mover binding');
    const targets = borrowed.targets;
    if (targets === null || typeof targets !== 'object') throw new Error('Missing borrowed mover targets');
    for (const row of rows) {
      if (!Object.hasOwn(targets, row.target) || !options.data.some(value => value.id === row.id) || views.has(row.id)) throw new Error('Unbound borrowed mover target');
      const target: unknown = Reflect.get(targets, row.target);
      if (row.chain === true) {
        if (!(target instanceof RopeChain) || row.group !== undefined || row.afterPose !== undefined) throw new Error('Borrowed mover requires its native chain');
        views.set(row.id, { chain: target, pose: () => undefined });
      } else {
        if (target === null || typeof target !== 'object' || row.group === undefined || !('group' in target)
          || !(target.group instanceof Object3D)) throw new Error('Borrowed mover requires its rendered group');
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
    }
  }
  if (options.shared !== undefined && options.composition !== undefined) throw new Error('Mover composition cannot replace an injected shared host');
  let tick = 0, host = options.shared?.host, composition: ReturnType<typeof createShardfileComposedLane> | undefined;
  if (host === undefined) {
    const assets = new Map<string, Uint8Array>();
    for (const hash of new Set(options.data.filter(row => row.execution !== 'native').map(row => row.module))) {
      const present = options.admitted?.get(hash); if (present !== undefined) { assets.set(hash, present); continue; }
      if (options.read !== undefined) { assets.set(hash, await options.read(hash)); continue; }
      const url = options.modules.get(hash); if (url === undefined) throw new Error('Missing mover module URL');
      const response = await fetch(url); if (!response.ok) throw new Error('Missing mover script'); assets.set(hash, new Uint8Array(await response.arrayBuffer()));
    }
    const query = scriptPhysicsQueries({ physics: world.physics, navigation: ctx.app.navmesh ?? { closestWalkable: () => null, findPath: () => null }, handle: () => undefined });
    if (options.composition === undefined) host = await createMoverHost(options.data, assets, query);
    else { composition = await createComposedMoverHost(options.data, assets, query, options.composition); host = composition.host; }
  }
  if (ctx.scope.disposed || ctx.scope.disposing) throw new Error('Mover scope left during admission');
  const runtime = new MoverRuntime(options.data, { ...(options.flags === undefined ? {} : { flags: options.flags }), physics: world.physics, scope: ctx.scope, host, adopt: (id) => views.get(id), ...(options.restoreFlags === undefined ? {} : { restoreFlags: options.restoreFlags }), activation: { ground: () => world.player.motor.result, ...options.activation } });
  options.prompts?.push(...runtime.ridePrompts());
  ctx.scope.onDispose(() => { if (runtime.riding()) world.player.carried = false; });
  const installedHost = host;
  ctx.system({ id: options.systemId, phase: 'fixed.pre', before: ['physics.movers'], run: () => {
    const current = options.shared === undefined ? ++tick : options.shared.tick();
    if (options.shared === undefined) { if (composition === undefined) installedHost.beginTick(current); else composition.step(current); }
    runtime.step(current, options.permissions?.());
    runtime.carryPlayer(world.player);
  } });
  if (options.onDispose !== undefined) ctx.scope.onDispose(options.onDispose);
  ctx.debug.expose(`movers.${options.systemId}`, { showRest: () => { runtime.showRest(); } }); // the map bake poses movers at rest
  return runtime;
}
