import { Signal, Field, Channel, Params, Read, Do } from './generated/nalatiNightRoster';
@inline function f(id: i32): f64 { return Read.field(0, id); }
@inline function put(id: i32, value: f64): void { Do.channel(id, value); }

// Native bindings dispatch at no more than ten Hz.
export function onSignal(signal: i32, value: f64, source: i32): void {
if (signal == Signal.roster) {
    let t = f(Field.respawn); const enabled = t >= 0 && f(Field.hold) == 0;
    if (enabled) t -= f(Field.dt);
    put(Channel.respawn, t); put(Channel.spawn, enabled && t < 0 && f(Field.night) == 1 ? 1 : 0);
  } else if (signal == Signal.rider) {
    const dt = f(Field.dt), killed = f(Field.alive) == 0 && f(Field.dead) == 0;
    let dying = f(Field.dying), fade = f(Field.fade), target = f(Field.fadeTarget);
    if (killed) { dying = Math.max(dying, .001); target = 0; }
    fade += (target - fade) * Math.min(1, dt * (target > fade ? 1.4 : 2.2));
    if (dying > 0) dying += dt;
    put(Channel.killed, killed ? 1 : 0); put(Channel.dead, killed ? 1 : f(Field.dead));
    put(Channel.dying, dying); put(Channel.fade, fade); put(Channel.fadeTarget, target); put(Channel.retire, dying >= 1.3 ? 1 : 0);
  } else if (signal == Signal.tonight) {
    const count = i32(f(Field.count)), night = i32(f(Field.night)), slot = i32(f(Field.slot));
    if (count <= 0) return;
    if (slot < 4) put(Channel.index, (night * 2 + slot * 2 + (slot >= 3 ? 1 : 0)) % Math.min(9, count));
    else if (count > 9) put(Channel.index, 9 + night % (count - 9));
  } else if (signal == Signal.warrior) {
    const dead = f(Field.alive) == 0, t = f(Field.t) + (dead ? f(Field.dt) : 0);
    put(Channel.broken, dead && f(Field.t) == 0 ? 1 : 0); put(Channel.t, t);
    put(Channel.retire, (dead && t > 3.2) || f(Field.gone) == 1 ? 1 : 0);
    put(Channel.statue, f(Field.gone) == 1 ? 1 : 0);
  } else if (signal == Signal.fire) {
    const t = f(Field.fireT) - f(Field.dt), d = f(Field.distance);
    put(Channel.fireT, t); put(Channel.shoot, t <= 0 && f(Field.quiet) == 0 && d < 62 && d > 6 && f(Field.engaged) == 1 ? 1 : 0);
  } else if (signal == Signal.retry) {
    put(Channel.fireT, 3 + Read.random() * 1.8);
  }
}
