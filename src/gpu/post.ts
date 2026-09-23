/**
 * The post chain in TSL (RenderPipeline), mirroring Game.buildComposer()'s low-poly chain (DRIFTWOOD-REMASTER L5):
 *
 *   scene pass (half float, linear HDR)
 *   → faint god rays (radial blur of the sun disc + halo) → bloom (only what is over the def's threshold), both pmndrs SCREEN
 *   → vignette → AgX → hue/saturation → brightness/contrast (in sRGB) → GradeEffect (split-tone, lift/gamma/gain) → the LUT
 *   → SMAA (tier) → sRGB (the pipeline's output transform)
 *
 * Each formula is the pmndrs / Grade.ts GLSL, term for term, so the two paths grade the same frame the same way.
 *
 *   const post = buildPost(renderer, scene, camera, { sunDisc, lut });   post.pipeline.render();
 */
import * as THREE from 'three';
import {
  Fn, Loop, agxToneMapping, clamp, distance, dot, float, length, max, min, mix, pass, pow, rtt, screenUV, select, smoothstep, sRGBTransferEOTF,
  sRGBTransferOETF, texture3D, uniform, vec2, vec3, vec4,
} from 'three/tsl';
import { RenderPipeline, type Node, type WebGPURenderer } from 'three/webgpu';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js';
import { lut3D } from 'three/examples/jsm/tsl/display/Lut3DNode.js';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG } from '../core/tier';
import { asVec3, asVec4 } from './bridge';

export interface GpuPost { pipeline: RenderPipeline; bloomStrength: Node<'float'> }
export interface PostInputs {
  /** the sky's sun disc (its halo sprite is its child): the god rays' light source */
  sunDisc: THREE.Object3D;
  /** the shard's learned LUT (a 3D texture, display sRGB → sRGB) when the sky has one */
  lut: THREE.Data3DTexture | null;
}

/**
 * pmndrs GodRaysEffect as the low-poly chain runs it: the light mask is the sun disc + its halo sprite drawn UNOCCLUDED
 * over black (its light pass has no scene depth), radially blurred toward the sun (60 / 24 samples, density 0.96,
 * decay 0.95, weight 0.5, exposure 0.4, clamp 1) at the tier's resolution scale. The mask is analytic here — the disc
 * and the sprite's radial gradient, evaluated per sample — so it needs no light pass. (pmndrs' Kawase pre-blur of the
 * mask is left out: at the chain's 12 % screen opacity it is invisible.)
 */
function godRays(camera: THREE.Camera, sunDisc: THREE.Object3D): Node<'vec3'> {
  const cam = camera as THREE.PerspectiveCamera;
  const tmp = new THREE.Vector3();
  const sunUV = uniform(new THREE.Vector2()).onRenderUpdate((_f, self) => {
    tmp.setFromMatrixPosition(sunDisc.matrixWorld).project(cam);
    return self.value.set(Math.min(Math.max((tmp.x + 1) * 0.5, -1), 2), Math.min(Math.max((1 - tmp.y) * 0.5, -1), 2)); // (screenUV is y-down)
  });
  const px = (worldR: number): Node<'float'> => uniform(0).onRenderUpdate(() => {
    const d = Math.max(1, cam.position.distanceTo(sunDisc.getWorldPosition(tmp)));
    return worldR / d / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
  });
  const discR = px(14), haloR = px(210);
  const aspect = uniform(1).onRenderUpdate(() => cam.aspect);
  const samples = TIER_CONFIG.godRaysSamples;
  const mask = (c: Node<'vec2'>): Node<'vec3'> => {
    const d = length(c.sub(sunUV).mul(vec2(aspect, 1)));
    const disc = float(1).sub(smoothstep(discR.mul(0.85), discR, d));
    const h = d.div(haloR);
    // the halo sprite's canvas gradient (Sky.buildSunDisc): 0 → .9 · .12 → .55 · .4 → .12 · 1 → 0, warm
    const ha = select(h.lessThan(0.12), mix(float(0.9), float(0.55), h.div(0.12)),
      select(h.lessThan(0.4), mix(float(0.55), float(0.12), h.sub(0.12).div(0.28)), mix(float(0.12), float(0), clamp(h.sub(0.4).div(0.6), 0, 1))));
    const hc = mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.67, 0.35), clamp(h.mul(2), 0, 1));
    return vec3(1.0, 0.95, 0.85).mul(disc).add(hc.mul(ha));
  };
  const rays = Fn(() => {
    const coord = screenUV.toVar();
    const delta = sunUV.sub(coord).mul(0.96 / samples).toVar();
    const illum = float(1).toVar();
    const acc = vec3(0).toVar();
    Loop(samples, () => {
      coord.addAssign(delta);
      acc.addAssign(mask(clamp(coord, 0, 1)).mul(illum).mul(0.5));
      illum.mulAssign(0.95);
    });
    return min(acc.mul(0.4), vec3(1));
  });
  return rtt(rays(), null, null, { resolutionScale: TIER_CONFIG.godRaysScale }).rgb;
}

const v3 = (a: readonly [number, number, number]): Node<'vec3'> => vec3(a[0], a[1], a[2]);

export function buildPost(renderer: WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, inputs: PostInputs): GpuPost {
  const { grade: G, style } = getActiveChunk();
  const stylized = style === 'lowpoly';
  const scenePass = pass(scene, camera);
  const hdr = scenePass.getTextureNode('output');

  // bloom: pmndrs mipmap bloom, threshold = the def's (1.0 on Driftwood: only the sun, glints, glyphs), soft knee 0.08 on the low-poly shard
  const b = bloom(hdr, G.bloomIntensity, 0.6, G.bloomThreshold);
  b.smoothWidth.value = stylized ? 0.08 : 0.3;
  const glow = asVec4(b).rgb; // (the node's output is its blurred texture; @types still calls the accessor getTexture)
  const screen = (x: Node<'vec3'>, y: Node<'vec3'>): Node<'vec3'> => x.add(y).sub(min(x.mul(y), 1)); // pmndrs SCREEN (x + y − min(xy, 1))
  // god rays first (SCREEN at 12 % on the low-poly shard), then the bloom, both over the scene (one EffectPass)
  const rays = godRays(camera, inputs.sunDisc);
  let c: Node<'vec3'> = mix(hdr.rgb, screen(hdr.rgb, rays), stylized ? 0.12 : 1);
  c = screen(c, glow);

  // vignette (pmndrs technique 0): offset 0.32, darkness 0.35 on the low-poly shard, 0.55 elsewhere
  const offset = 0.32, darkness = stylized ? 0.35 : 0.55;
  c = c.mul(smoothstep(0.8, offset * 0.799, distance(screenUV, vec2(0.5, 0.5)).mul(darkness + offset)));

  // AgX (three's, the same curve pmndrs ToneMappingMode.AGX runs)
  c = asVec3(agxToneMapping(c, float(1)));

  // hue/saturation (hue 0 = identity): pmndrs' saturation curve, clamped at 1
  const avg = c.r.add(c.g).add(c.b).div(3);
  const diff = vec3(avg, avg, avg).sub(c);
  const s = G.saturation;
  c = min(c.add(diff.mul(s > 0 ? 1 - 1 / (1.001 - s) : -s)), vec3(1));

  // brightness / contrast — in sRGB: pmndrs' BrightnessContrastEffect declares an sRGB input, so the EffectPass encodes
  // before it and decodes again for the (linear-input) GradeEffect after it
  const con = G.contrast;
  c = asVec3(sRGBTransferOETF(c)).add(G.brightness - 0.5);
  c = asVec3(sRGBTransferEOTF((con > 0 ? c.div(1 - con) : c.mul(1 + con)).add(0.5)));

  // GradeEffect (Grade.ts): split-tone, lift / gain / gamma, desaturated deep shadows
  const shadowTint = v3(G.shadowTint), highTint = v3(G.highTint), lift = v3(G.lift), gain = v3(G.gain);
  const l = dot(c, vec3(0.2126, 0.7152, 0.0722)).toVar();
  c = c.mul(mix(shadowTint, highTint, smoothstep(0.05, 0.75, l)));
  c = max(c.mul(gain).add(lift), vec3(0));
  if (G.gamma !== 1) c = pow(c, vec3(1 / G.gamma));
  const ds = smoothstep(0.18, 0, l);
  c = mix(c, vec3(dot(c, vec3(0.3333))), ds.mul(0.25));
  // the learned LUT (X1, lut.ts): the last grade step, display sRGB in → out (pmndrs LUT3DEffect, sRGB input)
  if (inputs.lut) c = asVec3(sRGBTransferEOTF(asVec4(lut3D(vec4(asVec3(sRGBTransferOETF(c)), 1), texture3D(inputs.lut), inputs.lut.image.width, float(1))).rgb));
  if (!stylized) c = clamp(c, 0, 1); // (the PBR shard's volumetrics / grain / fringe are not ported: Driftwood first)

  const graded = vec4(c, 1);
  const out: Node = TIER_CONFIG.smaa === 'off' ? graded : smaa(graded);
  const pipeline = new RenderPipeline(renderer, out);
  pipeline.outputColorTransform = true; // linear → sRGB (renderer.toneMapping stays NoToneMapping: AgX ran above)
  return { pipeline, bloomStrength: b.strength };
}
