/** Real held input leaves the home through its south road and enters it again. */
export function installCrossingProbe() {
  const api = window.__wildshard, grid = api.shard.grid.state();
  const home = grid.cells.find(cell => cell.instance === grid.home);
  if (!home || grid.live?.live.current !== home.instance) throw new Error('Crossing proof needs its entered home');
  const x = home.cell[0] * 555, z = home.cell[1] * 555;
  const state = { startedAt: performance.now(), done: false, errors: [], samples: [], timings: [], rows: [] };
  window.__loadingCrossing = state;
  // Reverse after the real transfer, rather than requiring a fast hover body
  // to land within 1.5 m of one exact road coordinate on a throttled frame.
  const game = api.world.game, player = api.world.player;
  let previous = '', left = false, stop = () => undefined;
  stop = game.watchFrames(() => {
    const current = api.shard.grid.state(), live = current.live;
    if (live?.live.current === null) left = true;
    const key = JSON.stringify([live?.crossing, current.inside, live?.live.gameplayReady]);
    if (key !== previous) {
      state.samples.push({ at: performance.now(), crossing: live?.crossing, inside: current.inside,
        gameplayReady: live?.live.gameplayReady, feet: live?.live.worldFeet }); previous = key;
    }
    const entered = left && live?.live.current === home.instance && current.inside === home.instance;
    if (!entered && performance.now() - state.startedAt < 120000 && live) {
      const feet = live.live.worldFeet, dx = x - feet.x, dz = z - (left ? 210 : 277.5) - feet.z;
      // Keep the ordinary travel mode on both legs. Dismounting at the road
      // boundary tests the deck's walking lip instead of transfer loading.
      player.setHover(true); player.yaw = Math.atan2(-dx, -dz); game.app.input.setHeld('move.forward', true);
      return;
    }
    state.finalState = { crossing: live?.crossing, live: live?.live, runtimeTiming: live?.runtimeTiming };
    if (!entered) state.errors.push(`Crossing route did not re-enter home: ${JSON.stringify({ left, feet: live?.live.worldFeet,
      issues: live?.live.issues, pending: live?.live.pending, residents: live?.live.residents, runtimeTiming: live?.runtimeTiming })}`);
    state.errors.push(...(window.__loadingAccuracy?.errors ?? []));
    const timings = live?.crossingTiming ?? [], rows = live?.crossingLoading ?? [];
    for (let i = 0; i < timings.length; i++) if (timings[i].requestedAt >= state.startedAt) {
      state.timings.push(timings[i]); state.rows.push(rows[i] ?? []);
    }
    state.endedAt = performance.now(); state.done = true;
    game.app.input.clear(); player.setHover(false); stop(); stop = () => undefined;
  });
  return true;
}

export const crossingProbeCode = () => `(${installCrossingProbe.toString()})()`;

/** Crossings retain their unobstructed play view: grade the actual phase table. */
export function crossingReport(state) {
  const failures = [...(state?.errors ?? [])], phases = ['prepare', 'boundary', 'checkpoint', 'commit', 'activate'];
  if (!state?.done || state.timings.length < 2 || !state.timings.some(row => row.to === null)
    || !state.timings.some(row => row.from === null && row.to !== null)) failures.push('Missing actual road exit or home re-entry');
  const transitions = (state?.timings ?? []).map((timing, index) => {
    const rows = state.rows[index] ?? [], boundaries = [timing.requestedAt, timing.readyAt, timing.start,
      timing.checkpointEnd, timing.commitEnd, timing.end];
    const wallMs = timing.end - timing.requestedAt, stageMs = rows.reduce((sum, row) => sum + row.ms, 0);
    if (boundaries.some((value, i) => !Number.isFinite(value) || (i > 0 && value < boundaries[i - 1]))) failures.push('Invalid crossing phase boundaries');
    if (rows.length !== phases.length || rows.some((row, i) => row.key !== phases[i] || !row.label || !Number.isFinite(row.ms) || row.ms < 0)) failures.push('Missing labelled crossing phase');
    if (Math.abs(wallMs - stageMs) > 1) failures.push('Crossing phase sum differs from wall time');
    return { from: timing.from, to: timing.to, wallMs, stageMs, rows };
  });
  return { transitions, failures };
}
