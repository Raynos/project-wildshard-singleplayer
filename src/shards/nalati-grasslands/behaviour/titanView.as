// Nalati zero R6: the Storm Titan's per-frame tells and pose as a SCRIPT-ABI v2 view module (lane 3), moved out of
// game/boss/arenaScript.ts. It runs inline at the fight's frame slot (after the life tell event, before the whirls, the
// fire and the aim). Its one binding's sample columns (generators/titanView.ts): the pose's current bend, raise and
// castL; the tell snapshot's bend, bendRate, raise, raiseRate, castL, tell, ringRadius, ringAlpha, forkRadius,
// forkAlpha, chainRadius, chainAlpha, struck and alpha; the spear's x and z; then per chain landing its on, x and z.
// The channel bank: the eased bend, raise and castL (cells the fight copies back to its pose), the aim's struck and
// alpha (cells the fight's aim reads), the spear and fork rings (x, z, radius, alpha; an alpha of 0 hides one), then
// per chain landing its ring.

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const CHANNELS: i32 = 18;
const CHAINS: i32 = 8;

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { return fuel; }

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
function ease(current: f64, target: f64, rate: f64, dt: f64): f64 { return current + (target - current) * Math.min(1, dt * rate); }

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY), out = region(CHANNELS);
  let written: i32 = 0;
  if (load<i32>(stamp + 4) != 0) {
    const c = IO + load<i32>(stamp + 20);
    const bend = load<f64>(c), raise = load<f64>(c + 8), castL = load<f64>(c + 16);
    const tellBend = load<f64>(c + 24), bendRate = load<f64>(c + 32), tellRaise = load<f64>(c + 40), raiseRate = load<f64>(c + 48);
    const tellCastL = load<f64>(c + 56), tell = load<f64>(c + 64);
    const ringRadius = load<f64>(c + 72), ringAlpha = load<f64>(c + 80), forkRadius = load<f64>(c + 88), forkAlpha = load<f64>(c + 96);
    const chainRadius = load<f64>(c + 104), chainAlpha = load<f64>(c + 112), struck = load<f64>(c + 120), aim = load<f64>(c + 128);
    const spearX = load<f64>(c + 136), spearZ = load<f64>(c + 144);
    // the pose eases toward the tell's targets at its rates (castL at a fixed 4 / s)
    store<f64>(out, ease(bend, tellBend, bendRate, dt)); store<f64>(out + 8, ease(raise, tellRaise, raiseRate, dt));
    store<f64>(out + 16, ease(castL, tellCastL, 4, dt));
    store<f64>(out + 24, struck); store<f64>(out + 32, aim);
    // the spear's ring and the fork's, at the spear while the tell is up
    const up = tell == 1;
    store<f64>(out + 40, spearX); store<f64>(out + 48, spearZ); store<f64>(out + 56, up ? ringRadius : 0); store<f64>(out + 64, up ? ringAlpha : 0);
    store<f64>(out + 72, spearX); store<f64>(out + 80, spearZ); store<f64>(out + 88, up ? forkRadius : 0); store<f64>(out + 96, up ? forkAlpha : 0);
    written = 13;
    // each chain landing's ring while it is on; an off landing writes nothing (alpha -1: its landing or the reset hid it)
    for (let chain: i32 = 0; chain < CHAINS; chain++) {
      const at = c + 152 + chain * 24, on = load<f64>(at) == 1, o = out + written * 8;
      store<f64>(o, load<f64>(at + 8)); store<f64>(o + 8, load<f64>(at + 16));
      store<f64>(o + 16, chainRadius); store<f64>(o + 24, on ? chainAlpha : -1);
      written += 4;
    }
  }
  store<i32>(entry(CHANNELS) + 16, written); store<i32>(IO + 76, written);
  return fuel;
}
