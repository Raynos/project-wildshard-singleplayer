// A PT2 scouting take (PROGRESS-TRAILER §4 PT2 (b)), not a trailer shot: on any era's Pine Hollow (--era, --query), stand
// at the rewind's candidate firing spot and look at its target, holding still, so the four builds' frames can be laid
// side by side on one sheet ("each visibly better than the last"). --opt {"spot": [x, z], "at": [x, y, z]} — `at.y` is
// metres over the spot's ground. Spawned on frame 0 (a herd alerts to a player parked near it during warm-up).
export const shot = {
  name: 'scout-rewind',
  era: 'app',
  query: 'chunk=pine-hollow&nolock=1&skipintro=1&mute=1',
  warmSec: 15,
  frames: 90,
  setup: function setup() {
    const w = window.__world ?? window.__wildshard.world;
    w.player.spawn(0, -235, Math.PI); // wait at the south gate; the take moves in on frame 0
    window.__takeFinal = () => ({ at: w.player.position.toArray().map((v) => Math.round(v * 100) / 100), yaw: w.player.yaw, pitch: w.player.pitch });
    return { spot: window.__takeOpt.spot, at: window.__takeOpt.at };
  }.toString(),
  step: function step(f, t, S) {
    const w = window.__world ?? window.__wildshard.world, p = w.player;
    if (f === 0) p.spawn(S.spot[0], S.spot[1], 0);
    const dx = S.at[0] - p.position.x, dz = S.at[2] - p.position.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(S.at[1] - 1.68, Math.hypot(dx, dz));
  }.toString(),
  accept() { return []; },
};
