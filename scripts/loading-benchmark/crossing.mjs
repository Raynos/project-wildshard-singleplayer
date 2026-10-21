import { installSoakDrive } from '../soak/drive.mjs';

/** Real held input leaves the home through its south road and enters it again. */
function installCrossingProbe(drive) {
  const api = window.__wildshard, grid = api.shard.grid.state();
  const home = grid.cells.find(cell => cell.instance === grid.home);
  if (!home || grid.live?.live.current !== home.instance) throw new Error('Crossing proof needs its entered home');
  const x = home.cell[0] * 555, z = home.cell[1] * 555;
  const state = { startedAt: performance.now(), done: false, errors: [], samples: [], timings: [], rows: [] };
  window.__loadingCrossing = state;
  drive({ steps: [{ kind: 'crossroads', id: 'loading-south-road', x, z: z - 277.5 },
    { kind: 'enter', instance: home.instance, slug: home.slug, x, z: z - 210 }] }, 120);
  let previous = '', stop = () => undefined;
  stop = api.world.game.watchFrames(() => {
    const current = api.shard.grid.state(), live = current.live;
    const key = JSON.stringify([live?.crossing, current.inside, live?.live.gameplayReady]);
    if (key !== previous) {
      state.samples.push({ at: performance.now(), crossing: live?.crossing, inside: current.inside,
        gameplayReady: live?.live.gameplayReady }); previous = key;
    }
    const entry = window.__sf57.events.find(event => event.type === 'entry' && event.admitted === true);
    const failure = window.__sf57.events.find(event => event.type === 'failure');
    if (!entry && !failure && !window.__sf57.done) return;
    if (!entry) state.errors.push(failure?.error ?? 'Crossing route did not re-enter home');
    const timings = live?.crossingTiming ?? [], rows = live?.crossingLoading ?? [];
    for (let i = 0; i < timings.length; i++) if (timings[i].requestedAt >= state.startedAt) {
      state.timings.push(timings[i]); state.rows.push(rows[i] ?? []);
    }
    state.endedAt = performance.now(); state.done = true;
    window.__sf57.stop(); stop(); stop = () => undefined;
  });
  return true;
}

export const crossingProbeCode = () => `(${installCrossingProbe.toString()})(${installSoakDrive.toString()})`;

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
