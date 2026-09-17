// Dev entry: base world + grass carpet + undergrowth + atmosphere particles.
// http://localhost:5173/dev/grass.html?nolock=1&x=0&z=-20&yaw=0&pitch=0
// window.__world = { ...bootstrap(), grass }, window.__gpu = { ms } (GPU frame time via timer queries)
import { bootstrap } from '../core/bootstrap';
import { Grass } from '../world/Grass';
import { Undergrowth } from '../world/Undergrowth';
import { Particles } from '../world/Particles';

const world = await bootstrap();
const grass = new Grass(world.sky, world.forest).build();
world.game.scene.add(grass.group);
const under = new Undergrowth(world.sky, world.forest).build();
world.game.scene.add(under.group);
const particles = new Particles(world.sky, world.forest).build();
world.game.scene.add(particles.group);
world.game.onUpdate((dt) => { grass.update(dt, world.player.position); under.update(dt, world.player.position); particles.update(dt, world.player.position, world.game.camera); });
console.log('undergrowth', JSON.stringify(under.counts));

(window as unknown as { __world: unknown }).__world = { ...world, grass, under, particles };
world.game.buildComposer();
installGpuTimer();
world.game.start();

/** Wraps composer.render in EXT_disjoint_timer_query_webgl2 queries → window.__gpu.ms (avg of last 30). */
function installGpuTimer() {
  const gl = world.game.renderer.getContext() as WebGL2RenderingContext;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const stats = { ms: 0, min: 0, samples: [] as number[] };
  (window as unknown as { __gpu: unknown }).__gpu = stats;
  if (!ext) return;
  const pending: WebGLQuery[] = [];
  const composer = world.game.composer;
  const orig = composer.render.bind(composer);
  composer.render = (dt?: number) => {
    // collect finished queries
    while (pending.length) {
      const q = pending[0];
      const avail = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (!avail) break;
      pending.shift();
      if (!disjoint) {
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
        stats.samples.push(ns / 1e6);
        if (stats.samples.length > 400) stats.samples.shift();
        stats.ms = stats.samples.reduce((a, b) => a + b, 0) / stats.samples.length;
        stats.min = Math.min(...stats.samples);
      }
      gl.deleteQuery(q);
    }
    if (pending.length < 4) {
      const q = gl.createQuery()!;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      orig(dt);
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(q);
    } else orig(dt);
  };
}
