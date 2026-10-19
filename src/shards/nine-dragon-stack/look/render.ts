// Nine Dragon Stack's render strategy (manifest.render → LookStrategy, core/Game.ts buildComposer): the Jiehua Neon look
// on the engine's composer. The engine's passes stay (the scene pass with the viewmodels in their depth slices, SMAA);
// the shard adds the bleed pyramid before the colour chain and replaces the chain with its own composite (ink
// silhouette, 晕染 bleed, window glow, drizzle, shoulder, the learned LUT, grain) — the clean room's frame, rebuilt on
// the engine (the clean room's post.ts, deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/look/post.ts).
// `window.__wildshard.shard['nd.render']` (captures / A/B, no URL switch): the live pieces and their switches.
import { Color, Fog, Matrix4, type Object3D, PerspectiveCamera, type Texture, type Vector2, Vector4 } from 'three';
import { Pass } from 'postprocessing';
import type { LookComposeContext, LookComposition, LookStrategy } from '@wildshard/engine/render/look';
import type { Tier } from '@wildshard/engine/core/tier';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { installRenderEvents } from './renderEvents';
import { ndRuntime } from '../runtime/state';
import { glowUniforms } from './light/glow';
import { gradeUniforms, loadLut } from './light/grade';
import metadata, { composite, PLAZA, STAIR, STREET, WELL, Y0 } from '../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows, CompositeRows } from '../boot/lookTypes.generated';
import { clearLanterns } from './lanterns';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { PostRowEffect, ScaledPostPass as RowRenderPass, prepareScaledPost } from '@wildshard/game/looks/scaledPost';
import type { ScaledPostRow } from '@wildshard/format/scaledPost';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';

import type { AoTuning } from './uniformTypes';
import { meshesWithUniform } from '../runtime/looks/uniformScan';
import type { Shared } from './style';
import { hasLentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { syncArchitecture, setDeclaredGraphParam } from './facadeMaterial';

const STREAK_PERF = new Vector4(2.5, 0.3, 0, 0);
const setStreakOn = (value: number): void => { setLentParam('nine-streaks', 'cardOn', value); };

const light = metadata.looks.light as LookRows['light'];

let post: Readonly<Record<'bleed' | 'reflect' | 'haze', ScaledPostRow>> & { readonly ao: AoTuning } | null = null;
/** Load the admitted post rows while the world stage may await. */
export async function prepareNinePost(renderer: Renderer): Promise<void> {
  await prepareScaledPost(renderer);
  const rows = await (await loadFirstPartyProduct('nine-dragon-stack')).json<{ readonly look: { readonly post: Readonly<Record<'bleed' | 'reflect' | 'haze', ScaledPostRow>>; readonly ao: AoTuning } }>('weapons/jian-row.json');
  post = { ...rows.look.post, ao: rows.look.ao };
}

/**
 * The silk fog for the look graphs (O11): data/lookGraphs.json 'nine-silk-fog' is FOG_GLSL's silkFog as a `kind: 'fog'`
 * graph, and the graph looks that select it (`effectState.fog`: the Well's mist sheets) are fogged by it in the engine's
 * fog epilogue. Every eye write its params take the live shared rows the programs read (the band lists are the graph's
 * own, `BANDS`; a capture that clears the bands' depth scales them by `bandDepth`). Uniform writes only.
 */
const SILK_FOG = 'nine-silk-fog';
const SILK_MATERIALS = [SILK_FOG, 'nine-canopy-cards', 'nine-canopy-inner', 'nine-streaks', 'nine-architecture', 'nine-architecture-cut', 'nine-facade', 'nine-facade-small', 'nine-windows', 'nine-halo'] as const;
const silkOut = { pair: [0, 0], v3: [0, 0, 0], col: [0, 0, 0], shaft: [0, 0, 0, 0], shaftK: [0, 0, 0, 0], deep: [0, 0, 0, 0], deepAir: [0, 0, 0, 0], deepAir2: [0, 0, 0, 0], puff: [0, 0] };
function syncSilkFog(shared: Shared): void {
  syncArchitecture(shared.u);
  setLentParam('nine-streaks', 'time', shared.u.uTime.value);
  setLentParam('nine-streaks', 'perf', STREAK_PERF.toArray());
  const u = shared.u, o = silkOut;
  setLentParam('nine-scroll', 'linePx', u.uLinePx.value);
  for (const id of SILK_MATERIALS) {
    if (!hasLentLook(id)) continue;
    setDeclaredGraphParam(id, 'rootAt', u.uRootAt.value.toArray(o.v3));
    if (id.startsWith('nine-architecture') || id.startsWith('nine-facade') || id === 'nine-windows') continue;
    setDeclaredGraphParam(id, 'datum', Y0);
    setDeclaredGraphParam(id, 'bandDepth', (u.uBands.value[0]?.z ?? 0) / shared.baseBandDepth);
    setDeclaredGraphParam(id, 'fogBase', u.uFogBase.value);
    setDeclaredGraphParam(id, 'fogStart', u.uFogStart.value);
    setDeclaredGraphParam(id, 'fogBaseCol', u.uFogBaseCol.value.toArray(o.col));
    setDeclaredGraphParam(id, 'shaft', u.uShaft.value.toArray(o.shaft));
    setDeclaredGraphParam(id, 'shaftK', u.uShaftK.value.toArray(o.shaftK));
    setDeclaredGraphParam(id, 'shaftLit', u.uShaftLit.value);
    setDeclaredGraphParam(id, 'fogDeep', u.uFogDeep.value.toArray(o.deep));
    setDeclaredGraphParam(id, 'deepAir', u.uDeepAir.value.toArray(o.deepAir));
    setDeclaredGraphParam(id, 'deepAir2', u.uDeepAir2.value.toArray(o.deepAir2));
    setDeclaredGraphParam(id, 'puff', u.uPuff.value.toArray(o.puff));
    if (id !== 'nine-canopy-cards' && id !== 'nine-canopy-inner') continue;
    setDeclaredGraphParam(id, 'lightDir', u.uLightDir.value.toArray(o.v3));
    setDeclaredGraphParam(id, 'ink0', u.uInk0.value.toArray(o.col));
    setDeclaredGraphParam(id, 'ink1', u.uInk1.value.toArray(o.col));
    setDeclaredGraphParam(id, 'inkMid', u.uInkMid.value);
    setDeclaredGraphParam(id, 'lineFade', u.uLineFade.value.toArray(o.pair));
  }
}

export interface NdRenderHandle {
  reflect: RowRenderPass | null;
  haze: RowRenderPass | null;
  bleed: RowRenderPass | null;
  jiehua: JiehuaEffect;
  camera: PerspectiveCamera;
  renderer: Renderer;
  /** the look's shared uniforms (the light pools' gains, the ambient) */
  shared: Shared;
  /** the emitter streak cards' gain for an emitter on screen (the reflection mirrors those) */
  /** set every streak card set's on-screen gain (the square's and the stair flights') */
  setCardOn: (v: number) => void;
  /** the streak cards' meshes (the square's, the stair flights' and landings') */
  streaks: Object3D[];
  /** (E281) the phone's light halos (light/halos.ts; null where the bleed pyramid glows instead) */
  /** (E283) the streak cards' perf knobs (streaks.ts STREAK_PERF, shared by every card set) */
  streakPerf: Vector4;
}

/** how much of an on-screen emitter's streak card stays once the reflection mirrors it */
const CARD_ON = 0.6;
/** (E281) the painted sky draws after the world's opaques (the viewmodels' depth clearer sits at 999): with its depth
 *  test at the far plane it then shades only where the sky shows — the skyline's layers cost nothing under the city */
const SKY_ORDER = 900;

/** Only live texture/camera bindings remain; static shader and tuning rows are author outputs. */
function jiehuaEffect(view: PerspectiveCamera, shared: Shared, glow: ReturnType<typeof glowUniforms>, grade: ReturnType<typeof gradeUniforms>) {
  const s = shared.u;
  const u = { ...uniformsFrom((composite as CompositeRows).uniforms), ...s, ...glow, ...grade, uInk: s.uInk0,
    uInvProj: { value: view.projectionMatrixInverse }, uCamWorld: { value: view.matrixWorld },
    tTight: { value: null as Texture | null }, tWide: { value: null as Texture | null }, tHaze: { value: null as Texture | null }, tRefl: { value: null as Texture | null } };
  const effect = Object.assign(new PostRowEffect((composite as CompositeRows).effect, u),
    { u, source: null as RowRenderPass | null, haze: null as RowRenderPass | null, refl: null as RowRenderPass | null, rainHaze: 6, sharpen: 0.35, pose: null as (() => void) | null });
  const sync = effect.update.bind(effect);
  effect.update = (renderer, input, deltaTime): void => {
    effect.pose?.();
    u.tTight.value = effect.source?.output('tight') ?? null; u.tWide.value = effect.source?.output('wide') ?? null;
    u.uHasBleed.value = u.tTight.value === null || u.tWide.value === null ? 0 : 1;
    u.tHaze.value = effect.haze?.enabled === true ? effect.haze.output('haze') : null; u.uRainHaze.value = u.tHaze.value === null ? 0 : effect.rainHaze;
    u.tRefl.value = effect.refl?.output('reflection') ?? null; u.uReflK.value = u.tRefl.value === null ? 0 : effect.refl?.debugGain ?? 1;
    u.uTexel.value.set(1 / input.width, 1 / input.height); u.uNF.value.set(view.near, view.far);
    u.uRain.value.w = renderer.getPixelRatio(); u.uSharp.value = renderer.getPixelRatio() < 2.5 ? effect.sharpen : 0;
    sync(renderer, input, deltaTime);
  };
  return effect;
}
type JiehuaEffect = ReturnType<typeof jiehuaEffect>;

/** The Jiehua composite and the side passes it reads (the wet floor, the haze march, the bleed pyramid; none on the phone). */
interface Composite { reflect: RowRenderPass | null; haze: RowRenderPass | null; bleed: RowRenderPass | null; jiehua: JiehuaEffect; pose: (() => void) | null }

/**
 * (SF63) the page camera seen from the world's root: inside a grid cell the root stands at the cell's render offset and the
 * programs shade in the root's frame (data/look.ts `uRootAt`), so the composite's depth reconstruction runs there too.
 * `pose` re-poses `view` from the camera; call it before anything reads `view` in a frame.
 */
function rootView(camera: PerspectiveCamera, root: Object3D): { view: PerspectiveCamera; pose: () => void } {
  const view = new PerspectiveCamera(), m = new Matrix4();
  view.name = 'nd-root-view';
  const pose = (): void => {
    camera.updateMatrixWorld();
    m.copy(root.matrixWorld).invert().multiply(camera.matrixWorld);
    m.decompose(view.position, view.quaternion, view.scale);
    view.fov = camera.fov; view.zoom = camera.zoom; view.aspect = camera.aspect; view.near = camera.near; view.far = camera.far;
    view.projectionMatrix.copy(camera.projectionMatrix);
    view.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    view.updateMatrixWorld(true);
  };
  pose();
  return { view, pose };
}

/** (SF63) a draw-free pass at the head of a cell's side passes: poses the root view before they read it */
class PoseView extends Pass {
  constructor(private readonly pose: () => void) {
    super('NdPoseView');
    this.needsSwap = false;
  }
  override render(): void { this.pose(); }
}

/**
 * Build the composite for a camera on a tier: standalone (compose) and inside a grid cell (`cell`, `root`: the world's root,
 * whose frame the cell's reconstruction runs in) build the same one.
 */
function buildComposite(camera: PerspectiveCamera, tier: Tier, glow: ReturnType<typeof glowUniforms>, grade: ReturnType<typeof gradeUniforms>, renderer: Renderer, root: Object3D | null = null): Composite {
  const world = ndRuntime().world;
  const framed = root === null ? null : rootView(camera, root);
  const view = framed?.view ?? camera;
  let reflect: RowRenderPass | null = null;
  let haze: RowRenderPass | null = null;
  let bleed: RowRenderPass | null = null;
  // Emergency phone profile: avoid the three custom passes while isolating the iPhone load failure.
  // At 402×812, DPR 2, their half-float RGBA targets total an estimated 7,550,992 bytes (7.20 MiB);
  // actual driver allocation and whether this causes the crash remain unconfirmed.
  if (tier !== 'phone') {
    // the wet floor at the square's datum: the plaza, the street north through the gate, the stair-street's foot
    const rect = new Vector4(WELL.x0 - 2, STREET.z0, Math.max(PLAZA.x1, STAIR.x0) + 4, PLAZA.z1 + 10);
    // (dome C2) and the stair-street's treads and landings, any height: x 22 … 102, z 2 … 10
    const stairRect = new Vector4(STAIR.x0, STAIR.z0, 102, STAIR.z1);
    if (post === null) throw new Error('Nine post rows have not loaded');
    const s = world.shared.u, params = { time: s.uTime, ground: { value: Y0 } };
    reflect = new RowRenderPass(post.reflect, { renderer, camera: view, params, links: { uFlagJoint: s.uFlagJoint, uRect: { value: rect }, uRect2: { value: stairRect }, uK: { value: new Vector4(Y0, 1, 0.045, 0.12) } } });
    haze = new RowRenderPass(post.haze, { renderer, camera: view, params, links: { ...s, uGroundY: { value: Y0 } } });
    bleed = new RowRenderPass(post.bleed, { renderer, camera: view, links: glow });
  }
  const jiehua = jiehuaEffect(view, world.shared, glow, grade);
  jiehua.source = bleed;
  jiehua.haze = haze;
  jiehua.refl = reflect;
  jiehua.pose = framed?.pose ?? null;
  return { reflect, haze, bleed, jiehua, pose: framed?.pose ?? null };
}

/** the drawing buffer the screen-space pieces measure: what `frame` reads of a renderer */
interface Buffer { getPixelRatio: () => number; getDrawingBufferSize: (target: Vector2) => Vector2 }

export function shardRender(): LookStrategy {
  let handle: NdRenderHandle | null = null;
  // the painted sky (world/build.ts, the 'nine-sky' look) is a sphere round the eye: it stands on uCam (the root's frame)
  let skyMesh: Object3D | null = null;
  const onEye = (root: Object3D, shared: Shared, camera: PerspectiveCamera): void => {
    shared.u.uHaloProjection.value = camera.projectionMatrix.elements[5];
    setLentParam('nine-streaks', 'projection', [camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]]);
    setLentParam('nine-streaks', 'flagJoint', shared.u.uFlagJoint.value);
    if (skyMesh?.parent !== root) skyMesh = root.getObjectByName('sky') ?? null;
    skyMesh?.position.copy(shared.u.uCam.value);
    syncSilkFog(shared);
  };
  const glow = glowUniforms();
  const grade = gradeUniforms();
  void (async (): Promise<void> => { const t = await loadLut(light.lut); grade.uLut.value = t; grade.uLutAmt.value = 1; })();
  let lastPr = 0;
  /** (SF63) inside a grid cell (no compose, no handle): the page's renderer, for the line widths and the buffer size */
  let cellBuffer: Buffer | null = null;
  // line widths are authored at 3× (look/style.ts uDpr). Below 3× a ruled line is thinner in buffer pixels and the
  // upscale to the screen softens it further: the phone's 2× draws them 20 % heavier, so they read at the clean
  // room's 3× weight (r12's mockup captures were drawn at 3×); and the drawing buffer's size for the screen-space pieces
  const lines = (renderer: Buffer, shared: Shared): void => {
    const pr = renderer.getPixelRatio();
    if (pr !== lastPr) { lastPr = pr; shared.u.uDpr.value = (pr / 3) * (pr < 2.5 ? 1.2 : 1); }
    renderer.getDrawingBufferSize(shared.u.uRes.value);
  };

  return {
    // (E281) the engine's cloud layer (a white cumulus dome for the daylight shards) has no place in a blue-hour sky
    // under the sky screens; the shard's own painted sky (look/style.ts) is the whole sky: the layer is never built, and
    // inside its grid cell that sky owns the horizon (`ownSky`, G321)
    sky: { clouds: false, planet: true, ownSky: true },
    // the learned LUT its composite applies, declared so a grid cell (which carries the engine chain, not this compose)
    // can carry it too (op-lut20; behind the grid's default-off Debug row)
    lut: light.lut,
    // the same composite inside a grid cell (op-frame21, SF63 / G158; behind the grid's default-off Debug row): it is the
    // whole colour chain, as standalone, where the chain slot holds the composite alone
    cell: {
      replaces: 'chain',
      build: (c) => {
        cellBuffer = c.renderer;
        c.scope.onDispose(() => { cellBuffer = null; });
        const { reflect, haze, bleed, jiehua, pose } = buildComposite(c.camera, c.tier, glow, grade, c.renderer, ndRuntime().world.root);
        // its scene-side parts, as compose sets them: the streak cards' gain (the whole wet-floor reflection where no
        // reflection pass runs) and, without the bleed pyramid, the phone's light halos
        const { uniforms: cardOns } = meshesWithUniform(c.root, 'uCardOn');
        for (const u of cardOns) u.value = reflect === null ? 1 : CARD_ON;
        setStreakOn(reflect === null ? 1 : CARD_ON);
        return { display: jiehua, passes: reflect === null || haze === null || bleed === null ? [] : [...(pose === null ? [] : [new PoseView(pose)]), reflect, haze, bleed] };
      },
    },
    compose(c: LookComposeContext): LookComposition {
      const world = ndRuntime().world;
      if (post === null) throw new Error('Nine post rows have not loaded');
      // AO at the city's scale, faded with the admitted fog distances.
      if (c.fx.ao !== null) {
        const row = post.ao, tier = c.tier === 'phone' ? 0 : 1;
        Object.assign(c.fx.ao.configuration, {
          aoRadius: row.radius, distanceFalloff: row.falloff, intensity: row.intensity,
          aoSamples: row.samples[tier], denoiseSamples: row.denoiseSamples[tier], denoiseIterations: row.denoiseIterations[tier],
          denoiseRadius: row.denoiseRadius, color: new Color(...row.color), halfRes: row.halfRes,
        });
        if (row.fog !== null && c.scene.fog instanceof Fog) { c.scene.fog.near = row.fog[0]; c.scene.fog.far = row.fog[1]; }
      }
      const { reflect, haze, bleed, jiehua } = buildComposite(c.camera, c.tier, glow, grade, c.renderer);
      const beforeChain: NonNullable<LookComposition['beforeChain']> = reflect === null || haze === null || bleed === null ? [] : [reflect, haze, bleed];
      // the streak cards (look/streaks.ts): found by their own uniform
      const { meshes: streaks, uniforms: cardOns } = meshesWithUniform(c.scene, 'uCardOn');
      const setCardOn = (v: number): void => { for (const u of cardOns) u.value = v; setStreakOn(v); };
      setCardOn(reflect === null ? 1 : CARD_ON);
      // the phone's glow: no bleed pyramid, so every light gets a halo in the drizzle
      const sky = world.root.getObjectByName('sky');
      if (sky !== undefined) sky.renderOrder = SKY_ORDER;
      handle = { reflect, haze, bleed, jiehua, camera: c.camera, renderer: c.renderer, shared: world.shared, setCardOn, streaks, streakPerf: STREAK_PERF };
      installRenderEvents(c, handle);
      c.debug.expose('nd.render', handle);
      return { beforeChain, chain: [jiehua] };
    },
    frame(): void {
      const rt = ndRuntime();
      rt.cull();
      const world = rt.world;
      const buffer = handle?.renderer ?? cellBuffer, view = handle?.camera ?? rt.camera;
      if (buffer !== null) lines(buffer, world.shared);
      // Pose the shared fog and sky from the drawn eye in either composition.
      world.shared.u.uCam.value.setFromMatrixPosition(view.matrixWorld);
      world.shared.bandWindow();
      onEye(world.root, world.shared, view);
      world.shared.u.uNear.value = view.near;
    },
    dispose(): void {
      handle = null;
      clearLanterns();
    },
  };
}
