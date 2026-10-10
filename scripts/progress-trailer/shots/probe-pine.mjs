// A PT2 scouting probe (PROGRESS-TRAILER §4), not a trailer shot: on any era's Pine Hollow (--era, --query), list the
// deer the build has around a point and the ground height at given points (player.spawn drops onto the terrain, so it
// doubles as the height query). --opt {"at": [x, z], "pts": [[x, z], …]}; the answer is the receipt's `setup` and
// `final` (the deer again after the herds have streamed in around `at`).
export const shot = {
  name: 'probe-pine',
  era: 'app',
  query: 'chunk=pine-hollow&nolock=1&skipintro=1&mute=1',
  warmSec: 15,
  frames: 240,
  setup: function setup() {
    const w = window.__world ?? window.__wildshard.world, o = window.__takeOpt;
    const r1 = (v) => Math.round(v * 10) / 10;
    const ground = (x, z) => { w.player.spawn(x, z, 0); return r1(w.player.position.y); };
    const heights = (o.pts ?? []).map(([x, z]) => [x, z, ground(x, z)]);
    const at = o.at ?? [0, -235];
    w.player.spawn(at[0], at[1], Math.PI);
    window.__takeFinal = () => {
      const list = w.animals?.animals ?? [];
      return list.filter((a) => a.kind === 'deer' && a.alive !== false)
        .map((a) => ({ p: [r1(a.position.x), r1(a.position.y), r1(a.position.z)], s: Math.round((a.mesh?.scale?.x ?? 1) * 100) / 100, v: a.model?.variant ?? a.variant ?? null, st: a.state }))
        .sort((a, b) => Math.hypot(a.p[0] - at[0], a.p[2] - at[1]) - Math.hypot(b.p[0] - at[0], b.p[2] - at[1]))
        .slice(0, 24);
    };
    return { heights, animals: Boolean(w.animals), count: (w.animals?.animals ?? []).length };
  }.toString(),
  step: function step() { /* stand still while the herds stream in */ }.toString(),
  accept() { return []; },
};
