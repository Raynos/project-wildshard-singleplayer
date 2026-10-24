import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';
import { trustedLevel, addBakedPieces } from '../../src/game/plugin/simulation';
import { tagOf } from '../../src/engine/physics/surface';
import { portalLinkEntries } from '../../src/format/portalLinkAssets';
import { installGrapple } from '../../src/game/grapple/headless';
import { parseGrappleProfile } from '../../src/format/grapple';
import { installHostPortalRide } from '../../src/game/shardfile/portalRideBinding';
import { installNativeItems } from '../../src/game/plugin/nativeItems';
import assembly from '../../src/shards/nine-dragon-stack/data/headlessAssembly.json' with { type: 'json' };

/** Direct typed native calls retain the Nine gameplay witness without a declaration interpreter. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async ({ product }) => {
  const shard = product.shardfile;
  const payload = await product.json<{
    spawnY: number; pieces: unknown; entryProof: { lanes: number; steps: number; portalTransfers: number };
    portalRide: Parameters<typeof installHostPortalRide>[3];
    grappleProfile: unknown; hooks: Parameters<typeof installGrapple>[4];
  }>('sim/headless-constants.json');
  const grapple = shard.modes?.grapple?.find(row => row.id === 'grapple');
  if (grapple === undefined) throw new Error('Nine Dragon declares its grapple mode');
  if (portalLinkEntries(shard.entryways).length !== 4) throw new Error('Nine Dragon declares four portal-link entryways');
  const level = trustedLevel(shard, { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, payload.spawnY), z: shard.spawn.z },
    yaw: shard.spawn.yaw, speed: 5 }, { size: 500, height: 0 });
  return { level, ports: { ground: false, heightAt: () => 0 }, proveEntries: () => payload.entryProof,
    install: (host, context) => {
      if (!context.restoring) addBakedPieces(host.physics, payload.pieces);
      const guard = context.restoring ? [] : host.physics.world.colliders.getAll().filter(collider => tagOf(collider)?.owner === 'nds-grapple-guard').map(collider => collider.handle);
      if (context.combat === undefined) throw new Error('Nine requires its native combat frame');
      installNativeItems(host, context.combat, { kind: 'swept', items: shard.items.rows, policy: assembly.constants.jianPolicy });
      const fact = (name: string, actorId: string): void => { context.emit({ kind: 'fact', name, actorId }); };
      installHostPortalRide(host, assembly.constants.portalStep, shard, payload.portalRide, fact);
      installGrapple(host, { emit: context.emit, commands: () => context.commands().map(command => command.kind === 'script' ? command : { kind: command.kind, ...(command.kind === 'player' && command.jump !== undefined ? { jump: command.jump } : {}) }) }, parseGrappleProfile(payload.grappleProfile), grapple, payload.hooks, guard);
    } };
};
