// Week 3 (c9aaa62ab, main's day 22): the earned hold — from Sky Reach's spawn view (the lapse's last frame), board up
// and hover off the edge across the gap, one unbroken take (PROGRESS-TRAILER §2.2 0:40). The hover is the build's own
// verb (`player.setHover`, the H key / HOVER button): 14 m/s top speed, 12 m/s² from a standstill.
// --opt {"spot": [x, z], "yaw": radians, "pitch": radians} (the spawn view; default Sunrest's rim facing the windmill isle).
export const shot = {
  name: 'w3-hover',
  era: 'app',
  query: 'chunk=far-reach&nolock=1&skipintro=1&mute=1',
  warmSec: 20,
  frames: 180,
  setup: function setup() {
    const w = window.__wildshard.world, o = window.__takeOpt;
    window.__takeFinal = () => ({ at: w.player.position.toArray().map((v) => Math.round(v * 10) / 10), hovering: Boolean(w.player.hovering ?? w.player.hover) });
    return { spot: o.spot ?? [0, -4] };
  }.toString(),
  step: function step(f, t, S) {
    const w = window.__wildshard.world, p = w.player, o = window.__takeOpt;
    if (f === 0) { p.spawn(S.spot[0], S.spot[1], o.yaw ?? 0); p.pitch = o.pitch ?? -0.04; }
    if (f === 12) p.setHover(true);
    if (f === 18) window.__hold('KeyW', true);
    p.pitch = (o.pitch ?? -0.04) + 0.03 * Math.sin(f * 0.03);
  }.toString(),
  accept(r) { return r.final ? [] : ['no final state']; },
};
