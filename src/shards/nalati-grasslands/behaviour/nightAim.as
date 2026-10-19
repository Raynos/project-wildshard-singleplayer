import { Signal, Field, Channel, Params, Read, List, Do } from './generated/nalatiNightAim';
@inline function f(id: i32): f64 { return Read.field(0, id); }
@inline function put(id: i32, value: f64): void { Do.channel(id, value); }

@inline function angle(y: f64, x: f64): f64 {
  const a = Math.abs(y) + .0000001, right = x >= 0;
  const r = right ? (x - a) / (x + a) : (x + a) / (a - x);
  const theta = (right ? Math.PI / 4 : Math.PI * 3 / 4) + (.1963 * r * r - .9817) * r;
  return y < 0 ? -theta : theta;
}
@inline function length(x: f64, z: f64): f64 { return Math.sqrt(x * x + z * z); }
// Native bindings dispatch at no more than ten Hz.
export function onSignal(signal: i32, value: f64, source: i32): void {
if (signal == Signal.aim) {
    const x = f(Field.x), y = f(Field.y), z = f(Field.z), t = length(f(Field.px) - x, f(Field.pz) - z) / 34;
    const dx = f(Field.px) + f(Field.vx) * t * .8 - x, dz = f(Field.pz) + f(Field.vz) * t * .8 - z, dy = f(Field.py) + 1.2 - y;
    const h = length(dx, dz), v2 = 1156.0, disc = v2 * v2 - 5 * (5 * h * h + 2 * dy * v2);
    const elevation = disc >= 0 ? angle(v2 - Math.sqrt(disc), 5 * Math.max(h, .001)) : Math.PI / 4;
    const spread = 1.4 * Math.PI / 180, yaw = angle(dx, dz) + (Read.random() - .5) * spread * 2, pitch = elevation + (Read.random() - .5) * spread;
    Read.radial(pitch, 34); const dyOut = List.at(0), horizontal = List.at(1);
    Read.radial(yaw, horizontal); put(Channel.dx, List.at(0)); put(Channel.dy, dyOut); put(Channel.dz, List.at(1));
  }
}
