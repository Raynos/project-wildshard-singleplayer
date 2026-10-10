// Week 3 (c9aaa62ab, main's day 22): the earned hold — from Sky Reach's spawn view (the lapse's last frame), board up
// and hover off the edge across the gap, one unbroken take (PROGRESS-TRAILER §2.2 0:40). The hover is the build's own
// verb (`player.setHover`, the H key / HOVER button): 14 m/s top speed, 12 m/s² from a standstill.
// --opt {"spot": [x, z], "yaw": radians, "pitch": radians} (default the shard's own spawn (0, −5.5), yaw 0, pitch 0: the
// Sky Reach lapse's crane ends on exactly this eye, `scripts/progress-trailer/lapses/sky-reach.mjs`).
export const shot = {
  name: 'w3-hover',
  era: 'app',
  query: 'chunk=far-reach&nolock=1&skipintro=1&mute=1',
  warmSec: 20,
  frames: 180,
  setup: function setup() {
    const w = window.__wildshard.world, o = window.__takeOpt;
    window.__takeFinal = () => ({ at: w.player.position.toArray().map((v) => Math.round(v * 10) / 10), hovering: Boolean(w.player.hovering ?? w.player.hover) });
    const spot = o.spot ?? [0, -5.5];
    w.player.spawn(spot[0], spot[1], o.yaw ?? 0); // spawned in the warm-up so frame 0 is the settled view (the lapse's last frame)
    w.player.pitch = o.pitch ?? 0;
    return { spot };
  }.toString(),
  step: function step(f) {
    const w = window.__wildshard.world, p = w.player, o = window.__takeOpt;
    if (f === 0) { p.yaw = o.yaw ?? 0; }
    if (f === 12) p.setHover(true);
    if (f === 18) window.__hold('KeyW', true);
    p.pitch = (o.pitch ?? 0) + 0.03 * Math.sin(f * 0.03);
  }.toString(),
  accept(r) { return r.final ? [] : ['no final state']; },
};
