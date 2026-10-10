// Nine Dragon Stack's render strategy (manifest.render → LookStrategy, core/Game.ts buildComposer): the Jiehua Neon look
// on the engine's composer. The engine's passes stay (the scene pass with the viewmodels in their depth slices, SMAA);
// the shard adds the bleed pyramid before the colour chain and replaces the chain with its own composite (ink
// silhouette, 晕染 bleed, window glow, drizzle, shoulder, the learned LUT, grain) — the clean room's frame, rebuilt on
// the engine (the clean room's post.ts, deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/look/post.ts).
// `window.__wildshard.shard['nd.render']` (captures / A/B, no URL switch): the live pieces and their switches.
import { Color, Fog, type IUniform, Mesh, type Object3D, type PerspectiveCamera, ShaderMaterial, Vector4 } from 'three';
import type { LookComposeContext, LookComposition, LookStrategy } from '@wildshard/engine/render/look';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { installRenderEvents } from './renderEvents';
import { ndRuntime } from '../runtime/state';
import { glowUniforms } from './light/glow';
import { gradeUniforms, loadLut } from './light/grade';
import { lightSources } from './light/install';
import { LUT_URL } from '../data/light';
import { type Halos, buildHalos } from './light/halos';
import { STREAK_PERF } from './streaks';
import { clearLanterns, updateLanterns } from './lanterns';
import { BleedPass } from './render/bleed';
import { BLEED, JiehuaEffect } from './render/jiehua';
import { ReflectPass } from './render/reflect';
import { HazePass } from './render/haze';
import { PLAZA, STAIR, STREET, WELL, Y0 } from '../layout';
import type { Shared } from './style';

export interface NdRenderHandle {
  reflect: ReflectPass | null;
  haze: HazePass | null;
  bleed: BleedPass | null;
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
  halos: Halos | null;
  /** (E283) the streak cards' perf knobs (streaks.ts STREAK_PERF, shared by every card set) */
  streakPerf: Vector4;
}

/** how much of an on-screen emitter's streak card stays once the reflection mirrors it */
const CARD_ON = 0.6;
/** (E281) the phone has no screen-space reflection: its cards are the whole wet-ground reflection, at full strength
 *  (pass 2's ×1.5 drew a curtain of colour over the stone the mockups keep visible) */
const PHONE_CARD_GAIN = 1;

/** (E281) the painted sky draws after the world's opaques (the viewmodels' depth clearer sits at 999): with its depth
 *  test at the far plane it then shades only where the sky shows — the skyline's layers cost nothing under the city */
const SKY_ORDER = 900;

export function shardRender(): LookStrategy {
  let handle: NdRenderHandle | null = null;
  const glow = glowUniforms();
  const grade = gradeUniforms();
  void (async (): Promise<void> => { const t = await loadLut(LUT_URL); if (t !== null) { grade.uLut.value = t; grade.uLutAmt.value = 1; } })();
  let lastPr = 0;

  return {
    // (E281) the engine's cloud layer (a white cumulus dome for the daylight shards) has no place in a blue-hour sky
    // under the sky screens; the shard's own painted sky (look/style.ts) is the whole sky: the layer is never built
    sky: { clouds: false, planet: true },
    compose(c: LookComposeContext): LookComposition {
      const world = ndRuntime().world;
      // AO at the city's scale: 2.2 m reaches the eave's underside, the awning's shadow on the wall, the step's riser and
      // the feet; an ink-blue occlusion (never black: the wash stays a wash); half res with a depth-aware upsample. It
      // runs before the ink silhouette (the composite), so the lines stay crisp over it
      const ao = c.fx.ao;
      if (ao !== null) {
        const k = ao.configuration;
        k.aoRadius = 2.2;
        k.distanceFalloff = 1;
        k.intensity = 5;
        k.aoSamples = c.tier === 'phone' ? 6 : 16;
        k.denoiseSamples = c.tier === 'phone' ? 4 : 8;
        k.denoiseIterations = c.tier === 'phone' ? 1 : 2;
        k.denoiseRadius = 8;
        k.color = new Color(0.07, 0.08, 0.13);
        k.halfRes = true;
        // n8ao fades its AO out with the scene's THREE.Fog distances (nothing else in the engine reads them: the Sky
        // sets 1 … 1e6 and Atmosphere.ts does its own fog maths). Post AO darkens whatever colour the pixel ends up,
        // the silk fog included: past ~25 m the fog is most of a far wall's colour, so the AO fades by 80 m — the Well's
        // deep strata were speckled with it
        if (c.scene.fog instanceof Fog) { c.scene.fog.near = 25; c.scene.fog.far = 80; }
      }
      let reflect: ReflectPass | null = null;
      let haze: HazePass | null = null;
      let bleed: BleedPass | null = null;
      const beforeChain: NonNullable<LookComposition['beforeChain']> = [];
      // Emergency phone profile: avoid the three custom passes while isolating the iPhone load failure.
      // At 402×812, DPR 2, their half-float RGBA targets total an estimated 7,550,992 bytes (7.20 MiB);
      // actual driver allocation and whether this causes the crash remain unconfirmed.
      if (c.tier !== 'phone') {
        // the wet floor at the square's datum: the plaza, the street north through the gate, the stair-street's foot
        const rect = new Vector4(WELL.x0 - 2, STREET.z0, Math.max(PLAZA.x1, STAIR.x0) + 4, PLAZA.z1 + 10);
        // (dome C2) and the stair-street's treads and landings, any height: x 22 … 102, z 2 … 10
        const stairRect = new Vector4(STAIR.x0, STAIR.z0, 102, STAIR.z1);
        reflect = new ReflectPass(c.camera, Y0, rect, () => world.shared.u.uTime.value, stairRect);
        haze = new HazePass(c.camera, world.shared, Y0, 0.5);
        bleed = new BleedPass(c.camera, glow, BLEED.threshold, BLEED.knee);
        beforeChain.push(reflect, haze, bleed);
      }
      const jiehua = new JiehuaEffect(c.camera, world.shared, glow, grade);
      jiehua.source = bleed;
      jiehua.haze = haze;
      jiehua.refl = reflect;
      // the streak cards (look/streaks.ts): found by their own uniform
      const cardOns: IUniform<number>[] = [];
      const streaks: Object3D[] = [];
      c.scene.traverse((o) => {
        if (!(o instanceof Mesh) || !(o.material instanceof ShaderMaterial)) return;
        const u = o.material.uniforms['uCardOn'];
        if (u !== undefined && typeof u.value === 'number') { cardOns.push(u as IUniform<number>); streaks.push(o); }
      });
      const setCardOn = (v: number): void => { for (const u of cardOns) u.value = v; };
      setCardOn(reflect === null ? 1 : CARD_ON);
      if (reflect === null) {
        for (const o of streaks) {
          const k = o instanceof Mesh && o.material instanceof ShaderMaterial ? o.material.uniforms['uCardK'] : undefined;
          if (k !== undefined && k.value instanceof Vector4) k.value.x *= PHONE_CARD_GAIN;
        }
      }
      // the phone's glow: no bleed pyramid, so every light gets a halo in the drizzle
      const src = lightSources();
      const halos = bleed === null && src !== null ? buildHalos(world.shared, src) : null;
      if (halos !== null) world.root.add(halos.mesh);
      const sky = world.root.getObjectByName('sky');
      if (sky !== undefined) sky.renderOrder = SKY_ORDER;
      handle = { reflect, haze, bleed, jiehua, camera: c.camera, renderer: c.renderer, shared: world.shared, setCardOn, streaks, halos, streakPerf: STREAK_PERF };
      installRenderEvents(c, handle);
      c.debug.expose('nd.render', handle);
      return { beforeChain, chain: [jiehua] };
    },
    frame(): void {
      ndRuntime().cull();
      const world = ndRuntime().world;
      if (handle === null) return;
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
      world.shared.bandWindow();
      world.shared.u.uNear.value = handle.camera.near;
      // the paper lanterns in view, bucketed near / far for this camera (look/lanterns.ts LOD)
      updateLanterns(handle.camera);
    },
    dispose(): void {
      if (handle?.halos) { handle.halos.mesh.removeFromParent(); handle.halos.mesh.geometry.dispose(); handle.halos.mesh.material.dispose(); }
      handle = null;
      clearLanterns();
    },
  };
}
