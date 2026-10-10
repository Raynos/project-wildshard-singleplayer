// Week 1 (2d2c5815a, main's day 8): the wooden sword's three-tap combo on a Driftwood Isle creature (PROGRESS-TRAILER
// §2.2 0:18). The prey is one the build spawned (the nearest live boar, or crab); the player spawns ~2.4 m from it on
// frame 0 facing it (a herd alerts to a player parked near it during warm-up) and the look follows it with lag.
// --opt {"kinds": ["boar", "crab"], "dist": m, "skip": n (take the n-th nearest)}.
export const shot = {
  name: 'w1-combo',
  era: 'legacy',
  query: 'chunk=driftwood-isle&nolock=1&skipintro=1&mute=1',
  warmSec: 15,
  frames: 150,
  setup: function setup() {
    const w = window.__world, o = window.__takeOpt;
    const weapons = w.weapons ?? window.__weapons; // main's day 8 exposes the manager as window.__weapons only
    window.__takeWeapons = weapons;
    weapons.setEnabled(true);
    const kinds = o.kinds ?? ['boar', 'crab'];
    const prey = w.animals.animals.filter((a) => kinds.includes(a.kind) && a.alive)
      .sort((a, b) => a.position.distanceTo(w.player.position) - b.position.distanceTo(w.player.position))[o.skip ?? 0] ?? null;
    window.__prey = prey;
    window.__takeFinal = () => ({ preyAlive: prey ? prey.alive : null, hp: prey?.hp ?? null });
    const r1 = (v) => Math.round(v * 10) / 10;
    return { prey: prey ? { kind: prey.kind, p: prey.position.toArray().map(r1), hp: prey.hp ?? null } : null, weapon: weapons.current?.id ?? null };
  }.toString(),
  step: function step(f) {
    const w = window.__world, p = w.player, e = window.__prey, o = window.__takeOpt;
    if (!e) return;
    if (f === 0) {
      const d = o.dist ?? 2.4, a = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
      p.spawn(e.position.x + Math.sin(a) * d, e.position.z + Math.cos(a) * d, 0);
      p.yaw = Math.atan2(-(e.position.x - p.position.x), -(e.position.z - p.position.z));
      p.pitch = -0.18;
    }
    const want = Math.atan2(-(e.position.x - p.position.x), -(e.position.z - p.position.z));
    let dy = want - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * 0.18;
    if (f === 14 || f === 30 || f === 46) { window.__takeWeapons.tryFire(); window.__takeEvents.push({ t: window.__sim.t, e: 'swing' }); }
  }.toString(),
  accept(r) {
    if (!r.setup?.prey) return ['no prey'];
    return r.events.filter((e) => e.e === 'swing').length === 3 ? [] : ['not three swings'];
  },
};
