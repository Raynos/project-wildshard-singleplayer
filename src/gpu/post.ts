/**
 * The post chain in TSL (RenderPipeline), mirroring Game.buildComposer()'s low-poly chain (DRIFTWOOD-REMASTER L5):
 *
 *   scene pass (half float, linear HDR)
 *   → bloom (only what is over the def's threshold, pmndrs SCREEN blend) → faint god rays (radial blur of the sun disc)
 *   → vignette → AgX → hue/saturation → brightness/contrast → GradeEffect (split-tone, lift/gamma/gain)
 *   → SMAA (tier) → sRGB (the pipeline's output transform)
 *
 * Each formula is the pmndrs / Grade.ts GLSL, term for term, so the two paths grade the same frame the same way.
 *
 *   const post = buildPost(renderer, scene, camera, { sunDisc });   post.pipeline.render();
 */
import type * as THREE from 'three';
import {
  agxToneMapping, clamp, distance, dot, float, max, min, mix, pass, pow, screenUV, smoothstep, sRGBTransferEOTF, sRGBTransferOETF, vec2, vec3, vec4,
} from 'three/tsl';
import { RenderPipeline, type Node, type WebGPURenderer } from 'three/webgpu';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG } from '../core/tier';
import { asVec3, asVec4 } from './bridge';

export interface GpuPost { pipeline: RenderPipeline; bloomStrength: Node<'float'> }

const v3 = (a: readonly [number, number, number]): Node<'vec3'> => vec3(a[0], a[1], a[2]);

export function buildPost(renderer: WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera): GpuPost {
  const { grade: G, style } = getActiveChunk();
  const stylized = style === 'lowpoly';
  const scenePass = pass(scene, camera);
  const hdr = scenePass.getTextureNode('output');

  // bloom: pmndrs mipmap bloom, threshold = the def's (1.0 on Driftwood: only the sun, glints, glyphs), soft knee 0.08 on the low-poly shard
  const b = bloom(hdr, G.bloomIntensity, 0.6, G.bloomThreshold);
  b.smoothWidth.value = stylized ? 0.08 : 0.3;
  const glow = asVec4(b).rgb; // (the node's output is its blurred texture; @types still calls the accessor getTexture)
  let c: Node<'vec3'> = hdr.rgb.add(glow).sub(min(hdr.rgb.mul(glow), 1));            // pmndrs SCREEN blend (x + y − min(xy, 1))

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
  if (!stylized) c = clamp(c, 0, 1); // (the PBR shard's volumetrics / grain / fringe are not ported: Driftwood first)

  const graded = vec4(c, 1);
  const out: Node = TIER_CONFIG.smaa === 'off' ? graded : smaa(graded);
  const pipeline = new RenderPipeline(renderer, out);
  pipeline.outputColorTransform = true; // linear → sRGB (renderer.toneMapping stays NoToneMapping: AgX ran above)
  return { pipeline, bloomStrength: b.strength };
}
