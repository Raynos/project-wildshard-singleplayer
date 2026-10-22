// Nine Dragon Stack's render strategy (manifest.render → LookStrategy, core/Game.ts buildComposer): the Jiehua Neon look
// on the engine's composer. The engine's passes stay (the scene pass with the viewmodels in their depth slices, SMAA);
// the shard adds the bleed pyramid before the colour chain and replaces the chain with its own composite (ink
// silhouette, 晕染 bleed, window glow, drizzle, shoulder, the learned LUT, grain) — the clean room's frame, rebuilt on
// the engine (the clean room's post.ts, deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/look/post.ts).
import { Color, Fog, type Object3D, type PerspectiveCamera, type Texture, type Vector2, Vector4 } from 'three';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import { Pass } from 'postprocessing';
import type { LookComposeContext, LookComposition, LookStrategy } from '@wildshard/engine/render/look';
import type { Tier } from '@wildshard/engine/core/tier';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { installRenderEvents } from './renderEvents';
import { ndRuntime } from '../runtime/state';
import { glowUniforms, gradeUniforms, light, loadLut } from './light';
import { composite, PLAZA, STAIR, STREET, WELL, Y0 } from '../boot/metadata.generated.json' with { type: 'json' };
import type { CompositeRows } from '../boot/lookTypes.generated';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { PostRowEffect, ScaledPostPass as RowRenderPass, prepareScaledPost } from '@wildshard/game/looks/scaledPost';
import type { ScaledPostRow } from '@wildshard/format/scaledPost';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';

import type { AoTuning } from './uniformTypes';
import type { Shared } from './style';
import { setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { syncLooks } from './facadeMaterial';

const setStreakOn = (value: number): void => { setLentParam('nine-streaks', 'cardOn', value); };

let post: Readonly<Record<'bleed' | 'reflect' | 'haze', ScaledPostRow>> & { readonly ao: AoTuning } | null = null;

/**
 * The silk fog for the look graphs (O11): data/lookGraphs.json 'nine-silk-fog' is FOG_GLSL's silkFog as a `kind: 'fog'`
 * graph, and the graph looks that select it (`effectState.fog`: the Well's mist sheets) are fogged by it in the engine's
 * fog epilogue. Every eye write its params take the live shared rows the programs read (facadeMaterial.ts `syncLooks`; a
 * capture that clears the bands' depth scales them by `bandDepth`). Uniform writes only.
 */
const syncSilkFog = (shared: Shared): void => { syncLooks(shared.u, { datum: Y0, bandDepth: (shared.u.uBands.value[0]?.z ?? 0) / shared.baseBandDepth }); };

/** the live composition the frame and the studio events read */
export interface NdRenderHandle {
  jiehua: JiehuaEffect;
  camera: PerspectiveCamera;
  renderer: Renderer;
  /** the look's shared uniforms (the light pools' gains, the ambient) */
  shared: Shared;
}

/** how much of an on-screen emitter's streak card stays once the reflection mirrors it */
const CARD_ON = 0.6;

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
  const frame = new FrameCamera(root);
  return { view: frame.pose(camera), pose: () => { frame.pose(camera); } };
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
  // the painted sky (the dressing step's, the 'nine-sky' look) is a sphere round the eye: it stands on uCam (the root's frame)
  let skyMesh: Object3D | null = null, skyRoot: Object3D | null = null;
  const onEye = (root: Object3D, shared: Shared, camera: PerspectiveCamera): void => {
    shared.u.uHaloProjection.value = camera.projectionMatrix.elements[5];
    setLentParam('nine-streaks', 'projection', [camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]]);
    if (skyRoot !== root) { skyRoot = root; skyMesh = root.getObjectByName('sky') ?? null; }
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
    // the admitted post rows, loaded while the world stage may await (the engine's world look preparation)
    prepareWorld: async ({ renderer }) => {
      await prepareScaledPost(renderer);
      const rows = await (await loadFirstPartyProduct('nine-dragon-stack')).json<{ readonly look: { readonly post: Readonly<Record<'bleed' | 'reflect' | 'haze', ScaledPostRow>>; readonly ao: AoTuning } }>('weapons/jian-row.json');
      post = { ...rows.look.post, ao: rows.look.ao };
    },
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
        // its scene-side part, as compose sets it: the streak cards' gain (the whole wet-floor reflection where no
        // reflection pass runs)
        setStreakOn(reflect === null ? 1 : CARD_ON);
        return { display: jiehua, passes: reflect === null || haze === null || bleed === null ? [] : [...(pose === null ? [] : [new PoseView(pose)]), reflect, haze, bleed] };
      },
    },
    compose(c: LookComposeContext): LookComposition {
      const world = ndRuntime().world;
      if (post === null) throw new Error('Nine post rows have not loaded');
      // AO at the city's scale, faded with the admitted fog distances.
      if (c.fx.ao !== null) {
        const row = post.ao;
        Object.assign(c.fx.ao.configuration, row[c.tier === 'phone' ? 'phone' : 'desktop'], { color: new Color(...row.color) });
        if (c.scene.fog instanceof Fog) [c.scene.fog.near, c.scene.fog.far] = row.fog;
      }
      const { reflect, haze, bleed, jiehua } = buildComposite(c.camera, c.tier, glow, grade, c.renderer);
      const beforeChain: NonNullable<LookComposition['beforeChain']> = reflect === null || haze === null || bleed === null ? [] : [reflect, haze, bleed];
      setStreakOn(reflect === null ? 1 : CARD_ON);
      handle = { jiehua, camera: c.camera, renderer: c.renderer, shared: world.shared };
      installRenderEvents(c, handle);
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
    },
  };
}
