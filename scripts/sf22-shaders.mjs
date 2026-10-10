/** Grade shader calls by their recorded synchronous renderer.compile phase, retaining all raw calls elsewhere.
 * Draw/driver calls and unknown phases fail. Long Task observation censors tasks below 50 ms: no reported task
 * means an upper bound of 50 ms, never an invented zero or exact sub-threshold maximum. Missing observation fails. */
export function shaderCompilationGate(compiles, tasks, longTasksAvailable, limitMs = 50) {
  const explicit = compiles.filter(call => call.phase === 'explicit-warm-up');
  const drawOrDriver = compiles.filter(call => call.phase === 'draw-or-driver');
  const unclassified = compiles.length - explicit.length - drawOrDriver.length;
  const validIntervals = compiles.every(call => Number.isFinite(call.start) && Number.isFinite(call.end) && call.end >= call.start)
    && tasks.every(task => Number.isFinite(task.start) && Number.isFinite(task.end) && task.end >= task.start
      && Number.isFinite(task.duration) && task.duration >= 0);
  const warmUpTasks = tasks.filter(task => explicit.some(call => call.start < task.end && call.end >= task.start));
  const observedMaxWarmUpTaskMs = warmUpTasks.length === 0 ? null : Math.max(...warmUpTasks.map(task => task.duration));
  const maxWarmUpTaskMsUpperBound = longTasksAvailable && validIntervals ? Math.max(50, observedMaxWarmUpTaskMs ?? 0) : null;
  return {
    totalCalls: compiles.length, explicitWarmUpCalls: explicit.length, drawOrDriverCalls: drawOrDriver.length,
    unclassifiedCalls: unclassified, longTasksAvailable, observerThresholdMs: 50, limitMs,
    observedWarmUpTasks: warmUpTasks.length, observedMaxWarmUpTaskMs, maxWarmUpTaskMsUpperBound,
    pass: validIntervals && Number.isFinite(limitMs) && limitMs >= 0 && drawOrDriver.length === 0 && unclassified === 0
      && maxWarmUpTaskMsUpperBound !== null && maxWarmUpTaskMsUpperBound <= limitMs,
  };
}
