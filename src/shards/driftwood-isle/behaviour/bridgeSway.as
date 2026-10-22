// G571 / WASM-HOST H9: the rope bridge's camera sway as a SCRIPT-ABI v2 view module (lane 3). Its one binding's current
// sample columns: whether the deck has a floor under the player (1 / 0), the player's y, that floor's y, the player's
// horizontal speed, then the nine rows of views/bridge-sway.json (height, ease, threshold, rate, speed, rollHz, roll,
// dipHz, dip). Each scheduled frame it eases its own sway toward on-deck, steps its own clock while the sway holds, and
// writes the channel bank: the roll and the dip the host adds to the camera after the frame (zero below the threshold).

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const CHANNELS: i32 = 18;

let sway: f64 = 0;
let clock: f64 = 0;

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { sway = 0; clock = 0; return fuel; }

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY), out = region(CHANNELS);
  let roll: f64 = 0, dip: f64 = 0;
  if (load<i32>(stamp + 4) != 0) {
    const c = IO + load<i32>(stamp + 20);
    const floored = load<f64>(c), y = load<f64>(c + 8), floor = load<f64>(c + 16), speed = load<f64>(c + 24);
    const height = load<f64>(c + 32), ease = load<f64>(c + 40), threshold = load<f64>(c + 48), rate = load<f64>(c + 56);
    const pace = load<f64>(c + 64), rollHz = load<f64>(c + 72), rollBy = load<f64>(c + 80), dipHz = load<f64>(c + 88), dipBy = load<f64>(c + 96);
    const on: f64 = floored > 0.5 && Math.abs(y - floor) < height ? 1.0 : 0.0;
    sway += (on - sway) * Math.min(1.0, dt * ease);
    if (sway >= threshold) {
      clock += dt * (rate + speed * pace);
      roll = Math.sin(clock * rollHz) * rollBy * sway;
      dip = Math.sin(clock * dipHz) * dipBy * sway;
    }
  }
  store<f64>(out, roll); store<f64>(out + 8, dip);
  store<i32>(entry(CHANNELS) + 16, 2); store<i32>(IO + 76, 2);
  return fuel;
}
