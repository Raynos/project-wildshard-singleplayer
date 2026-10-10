// Day 8 (2d2c5815a, main at the end of 23 Sep): a PT1 proof on the week-1 build — walk up to Driftwood Isle's hut and swing the
// starting sword (PROGRESS-TRAILER §3.1). Proves the legacy era adapter (window.__world, a THREE clock, the
// weapons manager, player.keys) on the second historical build; the trailer's week-1 play takes are PT3's.
export const shot = {
  name: 'd08-hut',
  era: 'legacy',
  query: 'chunk=driftwood-isle&nolock=1&skipintro=1&mute=1',
  warmSec: 15,
  frames: 300,
  setup: function setup() {
    const w = window.__world;
    const weapons = w.weapons ?? window.__weapons; // main's day 8 exposes the manager as window.__weapons only
    window.__takeWeapons = weapons;
    w.player.spawn(-30, -124, Math.PI); // inland below the hut (Driftwood's h2 view), facing +z: spawn() drops onto the
    // terrain, and the pier and its beach stand in water (the seabed under the deck, then swimming)
    w.player.pitch = -0.05;
    weapons.setEnabled(true);
    // events are the presses this take makes (wrapping this build's weapon / step hooks recursed: the SFX cue list
    // for melee is the press itself)
    const z0 = w.player.position.z;
    window.__takeFinal = () => ({ walked: Math.round((w.player.position.z - z0) * 10) / 10, weapon: weapons.current?.id ?? null });
    return { weapon: weapons.current?.id ?? null, at: w.player.position.toArray().map((v) => Math.round(v * 10) / 10) };
  }.toString(),
  step: function step(f) {
    const w = window.__world, p = w.player;
    if (f < 150) p.keys.add('KeyW'); else p.keys.delete('KeyW');
    p.yaw = Math.PI + Math.sin(f * 0.02) * 0.08; // a gentle look along the pier
    if (f === 170 || f === 215 || f === 255) { window.__takeWeapons.tryFire(); window.__takeEvents.push({ t: window.__sim.t, e: 'swing' }); }
  }.toString(),
  accept(r) {
    const swings = r.events.filter((e) => e.e === 'swing').length;
    const problems = [];
    if (swings < 2) problems.push(`${swings} swings`);
    if (!r.final || r.final.walked < 4) problems.push(`walked ${r.final?.walked} m`);
    return problems;
  },
};
