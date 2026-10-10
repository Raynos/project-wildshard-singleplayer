// Day 22 (c9aaa62ab): a PT1 proof on the week-3 build — walk Sky Reach's Sunrest isle toward the windmill bridge and
// attack (PROGRESS-TRAILER §3.1). Proves the app era adapter with the InputService driving movement (day 22 reads
// held moves through it); the trailer's week-3 play takes are PT3's.
export const shot = {
  name: 'd22-sunrest',
  era: 'app',
  query: 'chunk=far-reach&nolock=1&skipintro=1&mute=1',
  warmSec: 20,
  frames: 300,
  setup: function setup() {
    const w = window.__wildshard.world;
    w.player.spawn(0, -4, 0); // Sunrest's rim behind the h1 progress view (0, −9), facing the bridge (−z)
    w.player.pitch = -0.04;
    w.weapons?.setEnabled?.(true);
    const start = w.player.position.clone();
    window.__takeFinal = () => ({ walked: Math.round(Math.hypot(w.player.position.x - start.x, w.player.position.z - start.z) * 10) / 10, weapon: w.weapons?.current?.id ?? null });
    return { at: start.toArray().map((v) => Math.round(v * 10) / 10), weapon: w.weapons?.current?.id ?? null, hasWeapons: Boolean(w.weapons) };
  }.toString(),
  step: function step(f) {
    const w = window.__wildshard.world, p = w.player;
    window.__hold('KeyW', f < 80); // ~5 m: Sunrest's rim ends before the bridge head
    p.yaw = Math.sin(f * 0.02) * 0.06;
    if ((f === 175 || f === 220 || f === 262) && w.weapons) { w.weapons.tryFire(); window.__takeEvents.push({ t: window.__sim.t, e: 'attack' }); }
  }.toString(),
  accept(r) {
    const problems = [];
    if (!r.final || r.final.walked < 3) problems.push(`walked ${r.final?.walked} m`);
    if (!r.events.some((e) => e.e === 'attack')) problems.push('no attack (no weapons manager?)');
    return problems;
  },
};
