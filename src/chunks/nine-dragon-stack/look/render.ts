// Nine Dragon Stack's render strategy (ChunkDef.render → ShardRender, core/Game.ts buildComposer): the Jiehua Neon look
// on the engine's composer. The engine's passes stay (the scene pass with the viewmodels in their depth slices, SMAA);
// the shard adds the bleed pyramid before the colour chain and replaces the chain with its own composite (ink
// silhouette, 晕染 bleed, window glow, drizzle, shoulder, the learned LUT, grain) — the clean room's frame, rebuilt on
// the engine (look/post.ts is the clean room's own, kept for the dev page until it retires).
// `window.__ndRender` (captures / A/B, no URL switch): the live pieces and their switches.
import { Color, Fog, type IUniform, Mesh, type Object3D, type PerspectiveCamera, ShaderMaterial, Vector4, type WebGLRenderer } from 'three';
import type { ShardComposeContext, ShardComposition, ShardRender } from '../../ChunkDef';
import { nineDragonWorld } from '../index';
import { glowUniforms } from './light/glow';
import { gradeUniforms, loadLut } from './light/grade';
import { LUT_URL } from './light/install';
import { clearLanterns, updateLanterns } from './lanterns';
import { BleedPass } from './render/bleed';
import { BLEED, JiehuaEffect } from './render/jiehua';
import { ReflectPass } from './render/reflect';
import { HazePass } from './render/haze';
import { PLAZA, STAIR, STREET, WELL, Y0 } from '../layout';
import type { Shared } from './style';

export interface NdRenderHandle {
  reflect: ReflectPass;
  haze: HazePass;
  bleed: BleedPass;
  jiehua: JiehuaEffect;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** the look's shared uniforms (the light pools' gains, the ambient) */
  shared: Shared;
  /** the emitter streak cards' gain for an emitter on screen (the reflection mirrors those) */
  /** set every streak card set's on-screen gain (the square's and the stair flights') */
  setCardOn: (v: number) => void;
  /** the streak cards' meshes (the square's, the stair flights' and landings') */
  streaks: Object3D[];
}

/** how much of an on-screen emitter's streak card stays once the reflection mirrors it */
const CARD_ON = 0.6;

export function createRender(): ShardRender {
  let handle: NdRenderHandle | null = null;
  const glow = glowUniforms();
  const grade = gradeUniforms();
  void (async (): Promise<void> => { const t = await loadLut(LUT_URL); if (t !== null) { grade.uLut.value = t; grade.uLutAmt.value = 1; } })();
  let lastPr = 0;

  return {
    // n8ao on the phone tier too (the tier row has it off): the city's corners, eaves, awnings and feet. With it, the
    // viewmodel's depth slices must go: n8ao swaps the composer's buffers, so the colour chain would then draw into the
    // scene target while sampling that target's own depth texture (a feedback loop — GL_INVALID_OPERATION, a dropped
    // chain). Without slices the depth readers read the composer's stable depth copy (worldDepth.ts)
    slices: false,
    ao: true,
    compose(c: ShardComposeContext): ShardComposition {
      const world = nineDragonWorld();
      if (world === null) return {}; // the fragment did not build: the engine's chain as it is
      // AO at the city's scale: 2.2 m reaches the eave's underside, the awning's shadow on the wall, the step's riser and
      // the feet; an ink-blue occlusion (never black: the wash stays a wash); half res with a depth-aware upsample. It
      // runs before the ink silhouette (the composite), so the lines stay crisp over it
      const ao = c.fx.ao;
      if (ao !== null) {
        const k = ao.configuration;
        k.aoRadius = 2.2;
        k.distanceFalloff = 1;
        k.intensity = 5;
        k.aoSamples = c.tier === 'phone' ? 8 : 16;
        k.denoiseSamples = c.tier === 'phone' ? 4 : 8;
        k.denoiseRadius = 8;
        k.color = new Color(0.07, 0.08, 0.13);
        k.halfRes = true;
        // n8ao fades its AO out with the scene's THREE.Fog distances (nothing else in the engine reads them: the Sky
        // sets 1 … 1e6 and Atmosphere.ts does its own fog maths). Post AO darkens whatever colour the pixel ends up,
        // the silk fog included: past ~25 m the fog is most of a far wall's colour, so the AO fades by 80 m — the Well's
        // deep strata were speckled with it
        if (c.scene.fog instanceof Fog) { c.scene.fog.near = 25; c.scene.fog.far = 80; }
      }
      // the wet floor at the square's datum: the plaza, the street north through the gate, the stair-street's foot
      const rect = new Vector4(WELL.x0 - 2, STREET.z0, Math.max(PLAZA.x1, STAIR.x0) + 4, PLAZA.z1 + 10);
      // (dome C2) and the stair-street's treads and landings, any height: x 22 … 102, z 2 … 10
      const stairRect = new Vector4(STAIR.x0, STAIR.z0, 102, STAIR.z1);
      const reflect = new ReflectPass(c.camera, Y0, rect, () => world.shared.u.uTime.value, stairRect);
      const haze = new HazePass(c.camera, world.shared, Y0, c.tier === 'phone' ? 0.25 : 0.5);
      const bleed = new BleedPass(c.camera, glow, BLEED.threshold, BLEED.knee);
      const jiehua = new JiehuaEffect(c.camera, world.shared, glow, grade);
      jiehua.source = bleed;
      jiehua.haze = haze;
      // the streak cards (look/streaks.ts): found by their own uniform
      const cardOns: IUniform<number>[] = [];
      const streaks: Object3D[] = [];
      c.scene.traverse((o) => {
        if (!(o instanceof Mesh) || !(o.material instanceof ShaderMaterial)) return;
        const u = o.material.uniforms['uCardOn'];
        if (u !== undefined && typeof u.value === 'number') { cardOns.push(u as IUniform<number>); streaks.push(o); }
      });
      const setCardOn = (v: number): void => { for (const u of cardOns) u.value = v; };
      setCardOn(CARD_ON);
      handle = { reflect, haze, bleed, jiehua, camera: c.camera, renderer: c.renderer, shared: world.shared, setCardOn, streaks };
      Reflect.set(window, '__ndRender', handle);
      return { beforeChain: [reflect, haze, bleed], chain: [jiehua] };
    },
    frame(): void {
      const world = nineDragonWorld();
      if (world === null || handle === null) return;
      // line widths are authored at 3× (look/style.ts uDpr); the drawing buffer's size for the screen-space pieces
      // line widths are authored at 3× (look/style.ts uDpr). Below 3× a ruled line is thinner in buffer pixels and the
      // upscale to the screen softens it further: the phone's 2× draws them 20 % heavier, so they read at the clean
      // room's 3× weight (r12's mockup captures were drawn at 3×)
      const pr = handle.renderer.getPixelRatio();
      if (pr !== lastPr) { lastPr = pr; world.shared.u.uDpr.value = (pr / 3) * (pr < 2.5 ? 1.2 : 1); }
      const s = world.shared.u.uRes.value;
      handle.renderer.getDrawingBufferSize(s);
      // the eye the materials' silk fog is measured from: the camera as it is drawn (the world's updater runs before the
      // late hooks pose the camera, so it lags a frame — and a posed capture camera would fog from the player's eye)
      world.shared.u.uCam.value.setFromMatrixPosition(handle.camera.matrixWorld);
      world.shared.u.uNear.value = handle.camera.near;
      // the paper lanterns in view, bucketed near / far for this camera (look/lanterns.ts LOD)
      updateLanterns(handle.camera);
    },
    dispose(): void {
      if (handle !== null && Reflect.get(window, '__ndRender') === handle) Reflect.deleteProperty(window, '__ndRender');
      handle = null;
      clearLanterns();
    },
  };
}
