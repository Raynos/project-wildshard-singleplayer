import { Signal, Field, Channel, Params, Read, List, Do } from './generated/nalatiNight';
@inline function f(id: i32): f64 { return Read.field(0, id); }
@inline function put(id: i32, value: f64): void { Do.channel(id, value); }
@inline function angle(y: f64, x: f64): f64 {
  const a = Math.abs(y) + .0000001, right = x >= 0;
  const r = right ? (x - a) / (x + a) : (x + a) / (a - x);
  const theta = (right ? Math.PI / 4 : Math.PI * 3 / 4) + (.1963 * r * r - .9817) * r;
  return y < 0 ? -theta : theta;
}
@inline function length(x: f64, z: f64): f64 { return Math.sqrt(x * x + z * z); }
function ridge(s: f64, axis: i32): f64 {
  const d = Params.d4, total = d * 4, u = s - Math.floor(s / total) * total, q = i32(u / d);
  const a = q % 2 == 0 ? u - q * d : d - (u - q * d);
  let lo = 0.0, hi = Params.d1, x0 = Params.x0, x1 = Params.x1, z0 = 0.0, z1 = Params.z1;
  if (a > Params.d3) {lo = Params.d3; hi = d; x0 = Params.x3; x1 = 0; z0 = Params.z3; z1 = Params.z4;}
  else if (a > Params.d2) {lo = Params.d2; hi = Params.d3; x0 = Params.x2; x1 = Params.x3; z0 = Params.z2; z1 = Params.z3;}
  else if (a > Params.d1) {lo = Params.d1; hi = Params.d2; x0 = Params.x1; x1 = Params.x2; z0 = Params.z1; z1 = Params.z2;}
  const t = (a - lo) / (hi - lo);
  return axis == 0 ? (x0 + (x1 - x0) * t) * (q == 1 || q == 2 ? -1 : 1)
    : Params.center + (z0 + (z1 - z0) * t) * (q >= 2 ? -1 : 1);
}
@inline function nearest(x: f64, z: f64): f64 {
  return angle((z - Params.center) / Params.z4, x / Params.x0) / (Math.PI * 2) * Params.d4 * 4;
}

// Native bindings dispatch at no more than ten Hz.
export function onSignal(signal: i32, value: f64, source: i32): void {
if (signal == Signal.lineStart) {
    const at = f(Field.at), s = at < 0 ? nearest(-f(Field.px), Params.center * 2 - f(Field.pz)) : at;
    put(Channel.s, s); put(Channel.dir, Read.random() < .5 ? 1 : -1);
  } else if (signal == Signal.lineSlot) {
    const s = f(Field.s) - f(Field.slot) * 11, ax = ridge(s, 0), az = ridge(s, 1);
    put(Channel.x, ax); put(Channel.z, az); put(Channel.yaw, angle(-(az - Params.center) * Params.x0 / Params.z4, ax * Params.z4 / Params.x0));
  } else if (signal == Signal.line) {
    const dt = f(Field.dt), px = f(Field.px), pz = f(Field.pz), ax = f(Field.ax), az = f(Field.az);
    const distance = length(px - ax, pz - az), plateau = f(Field.py) > 18;
    let mode = f(Field.mode), s = f(Field.s), theta = f(Field.theta), t = f(Field.t);
    if (mode == 0 && distance < 70 && plateau) { mode = 1; t = 0; theta = angle(ax - px, az - pz); }
    else if (mode == 1 && (distance > 115 || !plateau)) { mode = 0; s = nearest(ax, az); }
    if (mode == 0) s += dt * Params.canter * .95;
    else { t += dt; theta += f(Field.dir) * dt * 11.5 / 34; }
    put(Channel.mode, mode); put(Channel.s, s); put(Channel.theta, theta); put(Channel.t, t);
  } else if (signal == Signal.target) {
    const slot = f(Field.slot); let tx = 0.0, tz = 0.0, speed = 11.5, turn = 2.2;
    if (f(Field.mode) == 0) {
      const s = f(Field.s) - slot * 11;
      const ax = ridge(s, 0), az = ridge(s, 1), dx = -(az - Params.center) * Params.x0 / Params.z4, dz = ax * Params.z4 / Params.x0;
      const norm = Math.max(.001, length(dx, dz)); tx = ax + dx / norm * 10; tz = az + dz / norm * 10;
      speed = length(ax - f(Field.ax), az - f(Field.az)) > 6 ? 11.5 : Params.canter;
    } else {
      const dir = f(Field.dir), theta = f(Field.theta) - dir * slot * (11.0 / 34) + dir * .4;
      Read.radial(f(Field.t) * .4 + slot, 5); const radius = 34 + List.at(0);
      Read.radial(theta, radius); tx = f(Field.px) + List.at(0); tz = f(Field.pz) + List.at(1); turn = 2.8;
    }
    put(Channel.x, tx); put(Channel.z, tz); put(Channel.speed, speed); put(Channel.turn, turn);
  }
}
