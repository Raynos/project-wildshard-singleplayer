/** Serialized into the clean Safari helper; only production controls and read-only grid telemetry are used. */
export function installSoakDrive(route, duration) {
  const probe = window.__wildshard, world = probe.world, player = world.player, game = world.game;
  const started = performance.now(), events = [];
  let index = 0, cycle = 0, stepAt = started, holdAt = null, lastResidents = [], entered = false, stopped = false;
  let stop = () => undefined;
  const report = (type, data = {}) => events.push({ type, seconds: (performance.now() - started) / 1000, cycle, ...data });
  window.__sf57 = { started, done: false, events, cycles: 0, index: 0, elapsed: 0, state: null, stop: () => { stopped = true; stop(); game.app.input.clear(); player.setHover(false); window.__sf57.stop = () => undefined; window.__sf57.state = null; stop = () => undefined; } };
  const advance = () => { index++; stepAt = performance.now(); holdAt = null; entered = false; game.app.input.clear(); };
  stop = game.watchFrames(() => {
    if (stopped) return;
    const now = performance.now(), status = window.__sf57, grid = probe.shard.grid.state(), live = grid.live?.live;
    if (!live) { report('failure', { error: 'Missing live registry' }); status.done = true; status.stop(); return; }
    status.elapsed = (now - started) / 1000; status.index = index; status.cycles = cycle; status.state = grid;
    for (const instance of lastResidents) if (!live.residents.includes(instance)) report('eviction', { instance, residents: live.residents });
    lastResidents = [...live.residents];
    if (status.elapsed >= duration) {
      report('complete'); status.done = true; status.stop(); return;
    }
    const point = route.steps[index];
    if (!point) { cycle++; index = 0; stepAt = now; holdAt = null; entered = false; report('circuit'); return; }
    const feet = live.worldFeet, dx = point.x - feet.x, dz = point.z - feet.z, distance = Math.hypot(dx, dz);
    if (point.kind === 'enter' && live.current === point.instance && grid.inside === point.instance && !entered) {
      entered = true; report('entry', { instance: point.instance, slug: point.slug, admitted: true, feet });
    }
    const arrive = distance < 1.5;
    if (point.kind === 'baseline' && arrive) {
      game.app.input.clear(); player.setHover(false);
      if (holdAt === null) { holdAt = now; report('settle-start', { feet, residents: live.residents }); }
      if (now - holdAt >= point.seconds * 1000) { report('settle-end', { feet, residents: live.residents }); advance(); }
      return;
    }
    if (arrive) {
      if (point.kind === 'enter' && !entered) report('entry', { instance: point.instance, admitted: false, reason: 'Reached pose without actual cell admission', feet, issues: live.issues });
      if (point.kind === 'crossroads') report('crossroads', { id: point.id, feet });
      advance(); return;
    }
    // Soft walls must refuse, never teleport around them. Give import/admission ten seconds of stalled walking.
    if (point.kind === 'enter' && now - stepAt > 15000 && !entered) {
      report('entry', { instance: point.instance, slug: point.slug, admitted: false, feet, issues: live.issues }); advance(); return;
    }
    if (now - stepAt > 90000) { report('failure', { error: `Controller stalled at ${index}`, feet, point, issues: live.issues }); status.done = true; status.stop(); return; }
    player.setHover(point.kind !== 'enter'); player.yaw = Math.atan2(-dx, -dz); game.app.input.setHeld('move.forward', true);
  });
  return true;
}
