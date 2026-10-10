// Day 15 (19a434635): a PT1 proof on the week-2 build — walk into Nine Dragon Stack's rain square and attack with the
// held weapon (PROGRESS-TRAILER §3.1). Proves the app era adapter (window.__wildshard.world, app.clock.setCapture)
// on the first build that has one; the trailer's week-2 play takes are PT3's.
export const shot = {
  name: 'd15-square',
  era: 'app',
  query: 'chunk=nine-dragon-stack&nolock=1&skipintro=1&mute=1',
  warmSec: 20,
  frames: 300,
  setup: function setup() {
    const w = window.__wildshard.world;
    w.player.spawn(0.95, 12, -0.21); // the square's south edge (the h1 progress view at (0.95, 7.5), 4.5 m back)
    w.player.pitch = -0.04;
    w.weapons?.setEnabled?.(true);
    const start = w.player.position.clone();
    window.__takeFinal = () => ({ walked: Math.round(Math.hypot(w.player.position.x - start.x, w.player.position.z - start.z) * 10) / 10, weapon: w.weapons?.current?.id ?? null });
    return { at: start.toArray().map((v) => Math.round(v * 10) / 10), weapon: w.weapons?.current?.id ?? null, hasWeapons: Boolean(w.weapons) };
  }.toString(),
  step: function step(f) {
    const w = window.__wildshard.world, p = w.player;
    window.__hold('KeyW', f < 150);
    p.yaw = -0.21 + Math.sin(f * 0.02) * 0.06;
    if ((f === 175 || f === 220 || f === 262) && w.weapons) { w.weapons.tryFire(); window.__takeEvents.push({ t: window.__sim.t, e: 'attack' }); }
  }.toString(),
  accept(r) {
    const problems = [];
    if (!r.final || r.final.walked < 4) problems.push(`walked ${r.final?.walked} m`);
    if (!r.events.some((e) => e.e === 'attack')) problems.push('no attack (no weapons manager?)');
    return problems;
  },
};
