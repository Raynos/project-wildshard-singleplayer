import { bindPlayerImpulse } from '@wildshard/game/shardfile/dataCreaturePorts';
import type { HeadlessRuntimeInstallation, PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import type { SimHost } from '@wildshard/engine/sim';
import { bindQuestWorldReactions, prepareRuntimeWorld, installDeclaredQuestHost, pickCommands, weaponRow, installNativeMelee } from '@wildshard/game/plugin/simulation';
import { SKY_NATIVE_WORLD } from '../data/nativeWorld';
import { FAN_ID } from '../data/items';
import { SKY_SPOTS } from '../data/questPrompts';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The shipping native world, bodies, quest and movers in a renderer-free host. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async ({ shard, assets }) => {
  const fanRow = weaponRow(shard, FAN_ID);
  const world = await prepareRuntimeWorld(shard, assets, baked, SKY_NATIVE_WORLD);
  const install = (host: SimHost, context: HeadlessRuntimeInstallation): void => {
    const environment = world.install(host, context), { ledger, keeper, encounter } = environment;
    // the browser disables the player's weapons through the Roc's intro (BossPorts.lockInput) and stows the fan on the board
    const reactions = shard.questHost?.page?.world; if (reactions === undefined) throw new Error('Missing admitted quest world reactions');
    const questWorld = bindQuestWorldReactions(reactions, { flags: host.flags });
    installNativeMelee(host, fanRow, fanRow.native, { inputCommands:context.commands, enabled:()=>!encounter.locked()&&!host.playerBoard.on,
      hook: environment.hooks.get(FAN_ID) ?? null, hookTick: environment.hookTick, landed: (action, from, dir) => { if (action === 2) questWorld.scan(from, dir); } });
    installDeclaredQuestHost(host, shard, { ...ledger, commands: pickCommands(context.commands, command => command.kind === 'script' ? command : undefined),
      spots: { interact: SKY_SPOTS, crack: [] }, observations: environment.observations,
      actions: environment.actions, directorActions: new Map() });
    // the updraft (G24): riding the board inside its column, a steady upward push through the host impulse, as the
    // browser's `far.updraft` fixed.pre system; read after this tick's move, it feeds the next one, as the browser's does
    bindPlayerImpulse(velocity => { host.impulsePlayer(velocity); }).columns(shard.modes?.traverse ?? [], () => host.player.position, () => host.playerBoard.on,
      (id, run) => { host.onStep(id, run); });
    keeper.settle();
  };
  return { level: world.level, ports: world.ports, install };
};
