import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { VANES } from '../layout';
import { FanStrikes, FAN_ID, type FanTarget } from '../weapons/fanStrikes';
import { turnVanes, VANE_HUB } from '../quest/vanes';

/** The fan's fixed-step adapter id. */
export const FAN_STEP = `item.${FAN_ID}`;
/** The script command actor that carries the fan's HEAVY and GUST (`{ kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.* }`). */
export const FAN_ACTOR = 'far.fan';
/** A fan command's value: the HEAVY slash, or the GUST. Both leave level along the player's commanded yaw. */
export const FAN_ACT = { heavy: 1, gust: 2 } as const;
/** The browser player's eye above the feet (engine Player EYE): the fan's aim leaves from the eye. */
const EYE = 1.68;
/** The tick protocol's command allowance (sdk/tickProtocol.ts): a tick never carries more. */
const MAX_COMMANDS = 1024;
/** One fan move this tick: a light SWING at a named target (the protocol's `player.attack`), or a HEAVY / GUST along the yaw. */
export type FanCommand = { readonly kind: 'swing'; readonly targetId: string } | { readonly kind: 'heavy' | 'gust' };

/**
 * Sky Reach's war fan in the renderer-free host (SF72, G51): the browser WarFan's own move recipe (weapons/fanStrikes.ts:
 * its cooldowns, the SWING / HEAVY arc slash and the GUST cone's impulse and wind hit), aimed from the player's eye. A
 * `player.attack` is a light SWING aimed at the commanded target's body; HEAVY and GUST are script commands aimed level
 * along the player's yaw (the browser aims along the camera). Targets are the host's live creatures in the combat
 * query's order, each pushed through its own impulse, as AnimalManager registers them. A GUST also turns every vane its
 * cone reaches once the keeper's notes are read (quest/vanes.ts, at the vane hubs world/build.ts places). The browser's
 * charge hold, viewmodel, cues and wind streaks are presentation. Its two cooldowns are exact continuation.
 */
export function installSkyFan(host: SimHost, commands: () => readonly FanCommand[]): FanStrikes {
  const targets = (): readonly FanTarget[] => [...host.entities.values()].flatMap(actor => {
    const port = host.combat.targetPort(actor.combatActor(), actor, velocity => { actor.impulse(velocity); });
    return port.hittable ? [port] : [];
  });
  const fan = new FanStrikes({ hit: req => host.combat.hit(req), targets });
  const vanes = VANES.map(vane => ({ id: vane.id, at: new Vector3(vane.x, vane.y + VANE_HUB, vane.z) }));
  const from = new Vector3(), dir = new Vector3();
  const eye = (): Vector3 => from.copy(host.player.position).setY(host.player.position.y + EYE);
  const level = (): Vector3 => dir.set(-Math.sin(host.player.yaw), 0, -Math.cos(host.player.yaw));
  host.onStep(FAN_STEP, dt => {
    fan.tick(dt);
    const list = commands();
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.kind !== 'swing') {
        if (command.kind === 'heavy') { if (fan.startSwing(true)) fan.slash(eye(), level(), true); }
        else if (fan.startGust()) { eye(); level(); fan.blow(from, dir); turnVanes(host.flags, vanes, from, dir); }
        continue;
      }
      const actor = host.entities.get(command.targetId); if (actor === undefined) continue;
      eye(); dir.copy(actor.position); dir.y += actor.dims.bodyY * actor.scale; dir.sub(from);
      if (dir.lengthSq() < 1e-9 || !fan.startSwing(false)) continue;
      fan.slash(from, dir.normalize(), false);
    }
  }, { snapshot: () => fan.snapshot(), restore: value => { fan.restore(value); } });
  return fan;
}
