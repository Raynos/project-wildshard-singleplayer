import type { LevelContext } from '#engine';
import type { Ride } from './ride';

/** Additive on-foot verbs remain live underneath the mounted and breaking controls. */
export function installRide(ctx: LevelContext, ride: Ride): void {
  const input = ctx.app.input, mount = ride.mount;
  ctx.inputContext({ id: 'ride.foot', actions: ['ride.whistle', 'ride.offer'],
    keys: { 'ride.whistle': ['KeyX'], 'ride.offer': ['KeyG'] },
    touch: { relabel: {}, verbs: { 'verb.1': 'ride.whistle', 'verb.2': 'ride.offer' } } });
  ctx.inputContext({ id: 'ride', actions: ['move.forward', 'move.back', 'move.left', 'move.right', 'ride.gallop', 'ride.horseTab', 'use'],
    keys: { 'move.forward': ['KeyW'], 'move.back': ['KeyS'], 'move.left': ['KeyA'], 'move.right': ['KeyD'],
      'ride.gallop': ['ShiftLeft', 'ShiftRight'] },
    touch: { relabel: { 'edge-l': { label: 'Dismount', tone: 'ready' } } } });
  ctx.inputContext({ id: 'ride.break', actions: ['lean.left', 'lean.right'], blocks: ['attack', 'aim', 'swap'],
    keys: { 'lean.left': ['KeyA'], 'lean.right': ['KeyD'] } });
  input.push('ride.foot', ctx.scope);
  mount.input = input; mount.equipment = () => ctx.app.equipment; ride.taming.input = input;
  const previous = mount.onMountChange;
  mount.onMountChange = (horse) => {
    previous?.(horse);
    if (horse) input.push('ride', ctx.scope);
    else { input.pop('ride.break'); input.pop('ride'); if (ctx.app.equipment) ctx.app.equipment.stowed = false; }
  };
  const breaking = ride.taming.onBreaking;
  ride.taming.onBreaking = (on) => {
    breaking?.(on);
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
