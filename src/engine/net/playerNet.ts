import type { SimHost } from '../sim';
import { netSchema, type NetSchema } from './schema';

// P1-E5.2 (E5-REPLICATION §3.5, §4.3): the player's wire fields over today's one-player SimHost. Others interpolate a
// quantised row; the owner gets the exact motion state back in the owner block. E5.2a makes the view per player; E5.3
// adds the rest of the predicted state (jump, swim and swing clocks, the mount) when the client predicts it.
const metres = { kind: 'f32q', min: -260, max: 260, bits: 16 } as const;
const onFoot = (host: SimHost, axis: 'x' | 'z'): number => host.playerBoard.on ? host.boardVelocity[axis] : host.playerSwim.on ? host.swimVelocity[axis] : host.playerWalk[axis];

/** The `player` class: a row for everyone else, an exact owner block for its owner. */
export const PLAYER_NET: NetSchema<SimHost> = netSchema<SimHost>({
  cls: 'player',
  fields: {
    x: { ...metres, send: 'others', read: host => host.player.position.x },
    y: { ...metres, send: 'others', read: host => host.player.position.y },
    z: { ...metres, send: 'others', read: host => host.player.position.z },
    yaw: { kind: 'angle', bits: 10, send: 'others', read: host => host.player.yaw },
    board: { kind: 'bool', read: host => host.playerBoard.on },
    swim: { kind: 'bool', read: host => host.playerSwim.on },
    hp: { kind: 'u16', read: host => Math.ceil(host.player.health.attributes.health) },
    px: { kind: 'f32', predicted: true, read: host => host.player.position.x },
    py: { kind: 'f32', predicted: true, read: host => host.player.position.y },
    pz: { kind: 'f32', predicted: true, read: host => host.player.position.z },
    vx: { kind: 'f32', predicted: true, read: host => onFoot(host, 'x') },
    vy: { kind: 'f32', predicted: true, read: host => host.playerBoard.on ? host.boardVelocity.y : host.playerSwim.on ? host.swimVelocity.y : host.playerFall.vy },
    vz: { kind: 'f32', predicted: true, read: host => onFoot(host, 'z') },
    grounded: { kind: 'bool', predicted: true, read: host => host.playerFall.grounded },
    dashT: { kind: 'f32', predicted: true, read: host => host.playerDash.t },
    dodgeT: { kind: 'f32', predicted: true, read: host => host.playerDodge.t },
    dodgeCd: { kind: 'f32', predicted: true, read: host => host.playerDodge.cd },
    shoveT: { kind: 'f32', predicted: true, read: host => host.playerShove.t },
  },
});
