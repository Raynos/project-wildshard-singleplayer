import type * as THREE from 'three';
import type { Scope } from '../app/scope';
import type { Game } from '../core/Game';
import { jsonSlot } from '../saves/slots';

/** DL10 (11-04): Debug ▸ Loading & memory ▸ Early shader compile. 'on' issues the programs of what the spawn view draws
 *  as soon as the world is built, so `KHR_parallel_shader_compile` links them on the driver's threads while the rest of
 *  loading (and its download) runs; the Shaders step then finds them linked. The Simulator's cold run spent 5.0 s there
 *  (Nine, 69fa647: 50 programs linked ≈ 3.5 s, all after the download). Default off: a compile under the download can
 *  contend with the phone's GPU process, so it ships behind this row until a Simulator / iPhone reading backs it (E451).
 *  A reload row: the first read of a page is its value. */
export const EARLY_PROGRAMS_SLOT = 'debug.earlyPrograms';
let frozen: boolean | undefined;
export function earlyProgramsOn(): boolean {
  frozen ??= jsonSlot(EARLY_PROGRAMS_SLOT, 'device').read() === 'on';
  return frozen;
}

let pending: Promise<void> | null = null;
let baked: Promise<BakedPrograms | null> | null = null, bakedStopped = false;
/** Issue the scene's programs for what lies within `radius` of `at` (the spawn view), in sliced issue passes; links
 *  proceed in parallel. Post, shadow, offscreen and family jobs stay with the Shaders step (they need the final page). */
export function startEarlyPrograms(game: Game, at: THREE.Vector3, radius: number): void {
  const owner = game.levelScope;
  pending = (async () => {
    try {
      const { precompileLevel, arrivalPrograms, liveWarmPacing } = await import('../render/precompile');
      // on WebKit the live pacing too (a few programs a presented frame), as the boot Shaders step takes it: no burst of
      // GPU-process links holds a loading frame (sp-x8's review)
      await precompileLevel(game, undefined, { sceneOnly: true, chunkCasters: false, sliceMs: 12, ...liveWarmPacing(),
        arrival: arrivalPrograms(game.scene, at, radius), current: () => !owner.disposed && !owner.disposing });
    } catch (error) {
      // the Shaders step compiles whatever this pass did not reach
      if (!owner.disposed && !owner.disposing) console.info('[programs] early compile stopped', error);
    }
  })();
}
/** The Shaders step waits for an early pass first, so the two never issue the same programs at once. A baked pass still
 *  issuing stops here: the Shaders step's own programs supersede what is left of it. */
export function earlyPrograms(): Promise<void> { bakedStopped = true; return pending ?? Promise.resolve(); }

/** DL10 (same Debug row): the GLSL pairs a recorded entry of this level linked, as data from the level's files. WebKit's GPU
 *  process keeps what it compiled by source (Playwright WebKit: 70 entry programs link in 225 ms the first time, 128 ms
 *  on any repeat, in the same or a new context or page), so linking the exact sources from the renderer step on lets the
 *  Shaders step's own links find them compiled, while the download and the world build still run. A program the build
 *  no longer makes only costs its link. */
/** Shaders share most of their lines (three's chunks), so each shader is a list of indices into one line table (Nine:
 *  3.9 MB of sources in 1.6 MB); a program is a [vertex, fragment] pair of shader indices. */
export interface BakedPrograms {
  readonly version: 2; readonly lines: readonly string[]; readonly shaders: readonly (readonly number[])[];
  readonly programs: readonly (readonly [number, number])[];
}
interface Held { readonly gl: WebGL2RenderingContext; readonly programs: WebGLProgram[]; readonly shaders: WebGLShader[] }
let held: Held | null = null;
/** The game queues the level's list (fetched in parallel) before the renderer exists; `null` = none for this level. */
export function queueBakedPrograms(list: Promise<BakedPrograms | null>): void {
  // an optional list: a failed read (offline, an HTML fallback page) is no list, settled here at once, so it never reaches
  // the page's unhandled-rejection boot failure before the renderer step would have read it (sp-x8's C25)
  baked = list.catch(() => null); bakedStopped = false;
}
/** After the renderer step: link the queued list on the game's own context, one program a painted frame where links
 *  queue in the GPU process ahead of frames (WebKit), all at once elsewhere. Nothing is read back (no status query
 *  waits on the GPU process); the objects are kept until `releaseBakedPrograms` so no link is cut short. */
export function issueBakedPrograms(game: Pick<Game, 'renderer' | 'levelScope'>): void {
  const list = baked; baked = null;
  if (list === null) return;
  const owner = game.levelScope, gl = game.renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext)) return;
  const mine: Held = { gl, programs: [], shaders: [] };
  held = mine;
  owner.onDispose(() => { releaseBakedPrograms(); });
  void (async () => {
    const data = await list;
    if (data === null || data.version !== 2) return;
    const { queuedLinks } = await import('../render/precompile');
    const perFrame = queuedLinks() ? 1 : Number.POSITIVE_INFINITY;
    const compiled = new Map<number, WebGLShader>();
    const shader = (at: number, type: number): WebGLShader | null => {
      const known = compiled.get(at); if (known !== undefined) return known;
      const rows = data.shaders[at], source = rows?.map(line => data.lines[line] ?? '').join('\n'), made = source === undefined ? null : gl.createShader(type);
      if (made === null || source === undefined) return null;
      gl.shaderSource(made, source); gl.compileShader(made); compiled.set(at, made); mine.shaders.push(made);
      return made;
    };
    let issued = 0;
    for (const [vertex, fragment] of data.programs) {
      if (bakedStopped || owner.disposed || owner.disposing || held !== mine || gl.isContextLost()) return;
      const vs = shader(vertex, gl.VERTEX_SHADER), fs = shader(fragment, gl.FRAGMENT_SHADER), program = gl.createProgram();
      if (vs === null || fs === null) continue;
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); mine.programs.push(program);
      // a disposed scope cancels its frame: the pass simply stops here
      if (++issued % perFrame === 0) await new Promise<void>(resolve => { owner.raf(() => { resolve(); }); });
    }
  })();
}
/** DL10 (same Debug row): a cold Safari's first shader link pays a one-time start-up (1.0-1.4 s on the Simulator, whatever
 *  the program; the Sim link probe, 11-04), which the GPU process keeps for later contexts and pages. On the title, after
 *  its first frames are drawn, one trivial program links on a throwaway context, so a cold entry finds the compiler up.
 *  The context is released at once. Off, nothing runs. */
export function warmShaderCompiler(scope: Pick<Scope, 'raf' | 'timeout'>): void {
  if (!earlyProgramsOn()) return;
  // after two painted frames and a beat: the title's own first frame never waits for it
  scope.raf(() => { scope.raf(() => { scope.timeout(250, () => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl === null) return;
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, '#version 300 es\nvoid main() { gl_Position = vec4(0.0); }'],
      [gl.FRAGMENT_SHADER, '#version 300 es\nprecision mediump float;\nout vec4 colour;\nvoid main() { colour = vec4(1.0); }']] as const) {
      const shader = gl.createShader(type);
      if (shader === null) return;
      gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader);
    }
    gl.linkProgram(program); // not read back: the GPU process links it on its own time
    scope.timeout(2000, () => { gl.getExtension('WEBGL_lose_context')?.loseContext(); });
  }); }); });
}

/** The Shaders step has linked the level's own programs: the baked copies go. */
export function releaseBakedPrograms(): void {
  const mine = held; held = null;
  if (mine === null || mine.gl.isContextLost()) return;
  for (const program of mine.programs) mine.gl.deleteProgram(program);
  for (const shader of mine.shaders) mine.gl.deleteShader(shader);
}
