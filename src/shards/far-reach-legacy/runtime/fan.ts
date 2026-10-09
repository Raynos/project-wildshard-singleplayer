import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { VANES } from '../data/layout';
import { FanStrikes, FAN_ID, type FanTarget } from '../weapons/fanStrikes';
import { turnVanes, VANE_HUB } from '../quest/vanes';

/** The fan's fixed-step adapter id. */
export const FAN_STEP = `item.${FAN_ID}`;
/** The script command actor that carries the fan's HEAVY and GUST (`{ kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.* }`). */
export const FAN_ACTOR = 'far.fan';
/** A fan command's value: the HEAVY slash, or the GUST. Both leave along the player's commanded yaw, at the tick's aim pitch. */
export const FAN_ACT = { heavy: 1, gust: 2 } as const;
/**
 * The script command actor that carries the tick's aim pitch (radians, up positive) for its HEAVY and GUST: the browser
 * aims them along the camera ray, whose pitch the player's look sets (engine Player, clamped to ±FAN_PITCH_LIMIT). A
 * tick without one aims level. Read per tick, never held, so it carries no continuation.
 */
export const FAN_AIM = 'far.fan.aim';
/** The browser player's look pitch limit (engine Player `pitch`), the most a fan move can aim up or down. */
export const FAN_PITCH_LIMIT = 1.45;
/** The browser player's eye above the feet (engine Player EYE): the fan's aim leaves from the eye. */
const EYE = 1.68;
/** The tick protocol's command allowance (sdk/tickProtocol.ts): a tick never carries more. */
const MAX_COMMANDS = 1024;
/** One fan move this tick: a light SWING at a named target (the protocol's `player.attack`), or a HEAVY / GUST along the yaw. */
export type FanCommand = { readonly kind: 'swing'; readonly targetId: string } | { readonly kind: 'heavy' | 'gust' } | { readonly kind: 'aim'; readonly pitch: number };

/**
 * Sky Reach's war fan in the renderer-free host (SF72, G51): the browser WarFan's own move recipe (weapons/fanStrikes.ts:
 * its cooldowns, the SWING / HEAVY arc slash and the GUST cone's impulse and wind hit), aimed from the player's eye. A
 * `player.attack` is a light SWING aimed at the commanded target's body; HEAVY and GUST are script commands aimed along
 * the player's yaw at the tick's `far.fan.aim` pitch (the browser aims them along the camera ray). Targets are the host's live creatures in the combat
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
  let pitch = 0;
  // the camera ray's direction at the player's yaw and the tick's pitch (engine Player.sampleAimCommand)
  const aim = (): Vector3 => { const cos = Math.cos(pitch); return dir.set(-Math.sin(host.player.yaw) * cos, Math.sin(pitch), -Math.cos(host.player.yaw) * cos); };
  host.onStep(FAN_STEP, dt => {
    fan.tick(dt);
    const list = commands();
    // the tick's last aim, wherever it sits in the list, aims every HEAVY and GUST of the tick
    pitch = 0;
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.kind === 'aim') pitch = Math.max(-FAN_PITCH_LIMIT, Math.min(FAN_PITCH_LIMIT, command.pitch));
    }
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.kind === 'aim') continue;
      if (command.kind !== 'swing') {
        if (command.kind === 'heavy') { if (fan.startSwing(true)) fan.slash(eye(), aim(), true); }
        else if (fan.startGust()) { eye(); aim(); fan.blow(from, dir); turnVanes(host.flags, vanes, from, dir); }
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
