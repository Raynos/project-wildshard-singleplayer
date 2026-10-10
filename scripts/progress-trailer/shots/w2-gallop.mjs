// Week 2 (19a434635, main's day 15): a mounted gallop across the Nalati steppe, first person from the saddle
// (PROGRESS-TRAILER §2.2 0:28). The build mounts the player on a camp horse at the gallop with its own `?ride=gallop`
// (a historical build's own param), then the take holds forward + sprint with a slow look drift.
export const shot = {
  name: 'w2-gallop',
  era: 'app',
  query: 'chunk=nalati-grasslands&ride=gallop&nolock=1&skipintro=1&mute=1',
  warmSec: 25,
  frames: 150,
  setup: function setup() {
    const w = window.__wildshard.world, p = w.player;
    const start = p.position.clone();
    window.__takeFinal = () => ({ moved: Math.round(Math.hypot(p.position.x - start.x, p.position.z - start.z) * 10) / 10, riding: Boolean(w.ride?.mounted ?? w.ride?.horse) });
    return { at: start.toArray().map((v) => Math.round(v * 10) / 10), yaw: Math.round(p.yaw * 100) / 100, ride: Boolean(w.ride) };
  }.toString(),
  step: function step(f) {
    const p = window.__wildshard.world.player;
    if (f === 0) { window.__hold('KeyW', true); window.__hold('ShiftLeft', true); }
    p.pitch = -0.02 + 0.05 * Math.min(1, f / 150);
  }.toString(),
  accept(r) { return r.final && r.final.moved > 8 ? [] : [`moved ${r.final?.moved} m`]; },
};
