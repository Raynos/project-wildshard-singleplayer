/**
 * Installing a MoverRuntime on a page's level (P1-E1): the page's fixed system over its world. The runtime, its script
 * host and the headless driver stay in `mover.ts`; the views a mover poses come from `client/plugin/moverViews.ts`.
 */
import type { World } from "@wildshard/engine/core/bootstrap";
import type { LevelContext } from "@wildshard/engine/level/context";
import { scriptPhysicsQueries } from "@wildshard/engine/script/queries";
import type { createShardfileComposedLane } from "../shardfile/scriptComposition";
import { createComposedMoverHost, createMoverHost, MoverRuntime, type MoverInstallation } from "./mover";

/** A single platform installer reads declared rows and owns their lifecycle; the shard only supplies presentation recipes. */
export async function installDeclaredMovers(ctx: LevelContext, world: World, options: MoverInstallation): Promise<MoverRuntime> {
  const views = new Map(options.views);
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
  const runtime = new MoverRuntime(options.data, { ...(options.flags === undefined ? {} : { flags: options.flags }), physics: world.physics, scope: ctx.scope, host, adopt: (id) => views.get(id), ...(options.restoreFlags === undefined ? {} : { restoreFlags: options.restoreFlags }), activation: { ground: () => [world.player.motor.result], ...options.activation } });
  options.prompts?.push(...runtime.ridePrompts());
  ctx.scope.onDispose(() => { if (runtime.riding()) world.player.carried = false; });
  const installedHost = host;
  // A page on a server poses these off rows (J130), so its own scripts never step.
  if (options.followed !== true) ctx.system({ id: options.systemId, phase: 'fixed.pre', before: ['physics.movers'], run: () => {
    const current = options.shared === undefined ? ++tick : options.shared.tick();
    if (options.shared === undefined) { if (composition === undefined) installedHost.beginTick(current); else composition.step(current); }
    runtime.step(current, options.permissions?.());
    runtime.carryPlayer(world.player);
  } });
  if (options.onDispose !== undefined) ctx.scope.onDispose(options.onDispose);
  ctx.debug.expose(`movers.${options.systemId}`, { showRest: () => { runtime.showRest(); } }); // the map bake poses movers at rest
  return runtime;
}
