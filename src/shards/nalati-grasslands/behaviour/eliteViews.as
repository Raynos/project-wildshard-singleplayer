// Nalati zero R9 (G621): the external elites' lane tells as a SCRIPT-ABI v2 view module (lane 3), moved out of
// game/quest/elitePage.ts. Its one binding's sample columns (generators/eliteViews.ts): the elite count, then per elite
// the values it lends (format/eliteFeature ELITE_VIEW_FIELDS): strike (0 none, 1 windup, 2 active), the strike lane's
// ends and width, the charge lane's time and ends. The channel bank: per elite its lane tell's x, z, x1, z1, width and
// alpha (an alpha of 0 hides it). A strike lane draws as the rider's tell (windup .42, active .36); a charge lane runs
// from the charge's start to 3 m short of its target, 3 m wide, fading in over its first half second.

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const CHANNELS: i32 = 18;
const FIELDS: i32 = 11;

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { return fuel; }

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY), out = region(CHANNELS);
  let written: i32 = 0;
  if (load<i32>(stamp + 4) != 0) {
    let c = IO + load<i32>(stamp + 20);
    const elites = <i32>load<f64>(c);
    c += 8;
    for (let elite: i32 = 0; elite < elites; elite++) {
      const strike = load<f64>(c), laneT = load<f64>(c + 48);
      let x: f64 = 0, z: f64 = 0, x1: f64 = 0, z1: f64 = 0, width: f64 = 0, a: f64 = 0;
      if (strike > 0.5) {
        x = load<f64>(c + 8); z = load<f64>(c + 16); x1 = load<f64>(c + 24); z1 = load<f64>(c + 32); width = load<f64>(c + 40);
        a = strike < 1.5 ? 0.42 : 0.36;
      } else if (laneT > 0) {
        x = load<f64>(c + 56); z = load<f64>(c + 64);
        const dx = load<f64>(c + 72) - x, dz = load<f64>(c + 80) - z;
        let distance = Math.sqrt(dx * dx + dz * dz);
        if (distance == 0) distance = 1;
        const k = Math.max(0, distance - 3) / distance;
        x1 = x + dx * k; z1 = z + dz * k; width = 3; a = 0.55 * Math.min(1, laneT * 2);
      }
      store<f64>(out + written * 8, x); store<f64>(out + written * 8 + 8, z); store<f64>(out + written * 8 + 16, x1);
      store<f64>(out + written * 8 + 24, z1); store<f64>(out + written * 8 + 32, width); store<f64>(out + written * 8 + 40, a);
      written += 6;
      c += FIELDS * 8;
    }
  }
  store<i32>(entry(CHANNELS) + 16, written); store<i32>(IO + 76, written);
  return fuel;
}
