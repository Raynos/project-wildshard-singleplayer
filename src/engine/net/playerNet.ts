import type { PlayerSim } from '../sim/playerSim';
import { netSchema, type NetSchema } from './schema';

// P1-E5.2 (E5-REPLICATION §3.5, §4.3): the player's wire fields. Others interpolate a quantised row; the owner gets the
// exact motion state back in the owner block. E5.3 adds the rest of the predicted state (jump, swim and swing clocks, the mount) when the client predicts it.
const metres = { kind: 'f32q', min: -260, max: 260, bits: 16 } as const;
const onFoot = (player: PlayerSim, axis: 'x' | 'z'): number => player.board.on ? player.boardVelocity[axis] : player.swim.on ? player.swimVelocity[axis] : player.walk[axis];

/** The `player` class: a row for everyone else, an exact owner block for its owner. */
export const PLAYER_NET: NetSchema<PlayerSim> = netSchema<PlayerSim>({
  cls: 'player',
  fields: {
    x: { ...metres, send: 'others', read: player => player.position.x },
    y: { ...metres, send: 'others', read: player => player.position.y },
    z: { ...metres, send: 'others', read: player => player.position.z },
    yaw: { kind: 'angle', bits: 10, send: 'others', read: player => player.yaw },
    board: { kind: 'bool', read: player => player.board.on },
    swim: { kind: 'bool', read: player => player.swim.on },
    hp: { kind: 'u16', read: player => Math.ceil(player.health.attributes.health) },
    held: { kind: 'u8', read: player => player.held },
    px: { kind: 'f32', predicted: true, read: player => player.position.x },
    py: { kind: 'f32', predicted: true, read: player => player.position.y },
    pz: { kind: 'f32', predicted: true, read: player => player.position.z },
    vx: { kind: 'f32', predicted: true, read: player => onFoot(player, 'x') },
    vy: { kind: 'f32', predicted: true, read: player => player.board.on ? player.boardVelocity.y : player.swim.on ? player.swimVelocity.y : player.fall.vy },
    vz: { kind: 'f32', predicted: true, read: player => onFoot(player, 'z') },
    grounded: { kind: 'bool', predicted: true, read: player => player.fall.grounded },
    dashT: { kind: 'f32', predicted: true, read: player => player.dash.t },
    dodgeT: { kind: 'f32', predicted: true, read: player => player.dodge.t },
    dodgeCd: { kind: 'f32', predicted: true, read: player => player.dodge.cd },
    shoveT: { kind: 'f32', predicted: true, read: player => player.shove.t },
  },
});
