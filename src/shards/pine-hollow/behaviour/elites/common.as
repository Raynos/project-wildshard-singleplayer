/** Pine's encounter decisions, shared by its v1 guests. Movement and contacts stay with platform runners. */
export function heading(x: f64, z: f64, tx: f64, tz: f64): f64 { return Math.atan2(tx - x, tz - z); }
export function distance(x: f64, z: f64, tx: f64, tz: f64): f64 { const dx = tx - x, dz = tz - z; return Math.sqrt(dx * dx + dz * dz); }
export function fleeHeading(x: f64, z: f64, px: f64, pz: f64, homeX: f64, homeZ: f64, leash: f64): f64 {
  let ax = x - px, az = z - pz;
  const length = Math.max(1e-9, Math.sqrt(ax * ax + az * az)); ax /= length; az /= length;
  const lx = x - homeX, lz = z - homeZ, ld = Math.sqrt(lx * lx + lz * lz);
  if (ld > 1e-3) {
    const out = Math.min(1, ld / leash), k = out * out;
    let tx = -lz / ld, tz = lx / ld;
    if (tx * ax + tz * az < 0) { tx = -tx; tz = -tz; }
    ax = ax * (1 - k) + tx * k - lx / ld * k * 0.6;
    az = az * (1 - k) + tz * k - lz / ld * k * 0.6;
  }
  return Math.atan2(ax, az);
}
