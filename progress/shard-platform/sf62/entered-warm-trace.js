(() => {
  const g = window.__wildshard.world.game, trace = { phase: 'road', programs: [], logs: [], warm: [], errors: [] };
  window.__enteredWarm = trace;
  const gl = WebGL2RenderingContext.prototype;
  for (const key of ['createProgram', 'getProgramInfoLog', 'getShaderInfoLog']) {
    const original = gl[key];
    gl[key] = function (...args) {
      const at = performance.now(), value = Reflect.apply(original, this, args), ms = performance.now() - at;
      (key === 'createProgram' ? trace.programs : trace.logs).push({ key, at, ms, phase: trace.phase });
      return value;
    };
  }
  window.addEventListener('error', event => trace.errors.push(event.message));
  window.addEventListener('unhandledrejection', event => trace.errors.push(String(event.reason)));
  const warm = g.warmEnteredFrame;
  g.warmEnteredFrame = async function (owner) {
    trace.phase = 'warming';
    const before = trace.programs.length, at = performance.now();
    try {
      await Reflect.apply(warm, this, [owner]);
      trace.warm.push({ owner: owner.name, at, ms: performance.now() - at, programs: trace.programs.length - before });
      trace.phase = 'post-warm';
    } catch (error) { trace.errors.push(String(error)); throw error; }
  };
  return { attached: true, state: window.__wildshard.shard.grid.state() };
})()
