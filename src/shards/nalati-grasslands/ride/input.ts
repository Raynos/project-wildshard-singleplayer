import type { LevelContext } from '@wildshard/engine/level/context';
import type { Ride } from './ride';

/** pause ▸ Settings ▸ Key bindings (E357 J10): the riding rows show on this shard only; mounted, Shift gallops instead of sprinting */
export const RIDE_KEY_ROWS = [
  { group: 'riding', id: 'whistle', label: 'Call horse', actions: ['ride.whistle'] },
  { group: 'riding', id: 'gallop', label: 'Gallop', actions: ['ride.gallop'], shares: ['sprint', 'surface'] },
  { group: 'riding', id: 'offer', label: 'Offer (hold)', actions: ['ride.offer'] },
] as const;
/** Additive on-foot verbs remain live underneath the mounted and breaking controls. */
export function installRide(ctx: LevelContext, ride: Ride): void {
  const input = ctx.app.input, mount = ride.mount;
  ctx.inputContext({ id: 'ride.foot', actions: ['ride.whistle', 'ride.offer'],
    keys: { 'ride.whistle': ['KeyX'], 'ride.offer': ['KeyG'] },
    touch: { relabel: {}, verbs: ride.hud.inputVerbs() } });
  ctx.inputContext({ id: 'ride', actions: ['move.forward', 'move.back', 'move.left', 'move.right', 'ride.gallop', 'ride.horseTab', 'use'],
    keys: { 'move.forward': ['KeyW'], 'move.back': ['KeyS'], 'move.left': ['KeyA'], 'move.right': ['KeyD'],
      'ride.gallop': ['ShiftLeft', 'ShiftRight'] },
    touch: { relabel: { 'edge-l': { label: 'Dismount', tone: 'ready' } }, verbs: ride.hud.inputVerbs(true) } });
  ctx.inputContext({ id: 'ride.break', actions: ['lean.left', 'lean.right'], blocks: ['attack', 'aim', 'swap', 'ride.whistle', 'ride.offer', 'ride.horseTab'],
    keys: { 'lean.left': ['KeyA', 'ArrowLeft'], 'lean.right': ['KeyD', 'ArrowRight'] } });
  // A movement rebind may have been saved on another shard before these contexts existed. The table keeps both
  // actions together from here on; initialize lean from the effective on-foot keys without writing default saves.
  for (const [lean, move] of [['lean.left', 'move.left'], ['lean.right', 'move.right']] as const) {
    const keys = input.bindings.keys('onFoot')[move];
    if (keys !== undefined && keys.join('\0') !== input.bindings.keys('ride.break')[lean]?.join('\0')) input.bindings.assign('ride.break', lean, keys);
  }
  input.bindings.describe({ rows: RIDE_KEY_ROWS }, ctx.scope);
  input.push('ride.foot', ctx.scope);
  mount.input = input; mount.equipment = () => ctx.app.equipment; ride.taming.input = input;
  mount.onMountChange = (horse) => {
    if (horse) input.push('ride', ctx.scope);
    else { input.pop('ride.break'); input.pop('ride'); if (ctx.app.equipment) ctx.app.equipment.stowed = false; }
  };
  ride.taming.onBreaking = (on) => {
    if (on) input.push('ride.break', ctx.scope); else input.pop('ride.break');
    if (ctx.app.equipment) ctx.app.equipment.stowed = on;
  };
  ctx.system({ id: 'shard.nalati.ride.input', phase: 'input', before: ['engine.player.input'], run: () => {
    if (input.consume('ride.whistle')) mount.whistle();
    if (input.consume('ride.gallop')) mount.gallopTap();
    if (input.consume('ride.horseTab') && !mount.breaking) mount.dismount();
  } });
  ctx.scope.onDispose(() => { mount.dismount(); mount.input = null; mount.equipment = null; ride.taming.input = null; });
  ctx.debug.expose('nalati.ride', ride);
}
