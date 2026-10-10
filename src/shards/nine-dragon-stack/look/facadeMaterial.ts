// Copied from the facade lab (the dev labs (deleted in E357 F7), round-7-lab-facade) into the clean room.
// The facade lab's programs (a simple Jiehua Neon: P1 "ink" owns the real surface look).
//  - jiehua: flat wash × two hard bands of top light, ruled ink edges from aFace + fwidth (constant px, fading into
//    the wash when sub-pixel), the kit's patterns (slab bands, glazed tiles, bars, stripes, leaves, AC fans, slats,
//    pipe brackets, lit sign boxes), silk fog. Opaque only: no discard anywhere (the iPhone's hidden-surface removal).
//  - window: interior mapping (Spider-Man / Matrix Awakens) on ONE instanced quad per window — the reveal, the glass
//    with its mullions, a curtain, a room box with a partition and a fluorescent tube, all ruled; lit or dark.
//  The ink-wash shadow under each projection, the drip stains and the neon spill are baked into the shell's vertex
//  colours by the grammar (no transparent decals: overdraw is the phone's enemy).
// SHARD-PLATFORM M3: the programs are rows in data/facadeLook.ts on the SDK shader family; this module makes the materials.
import { type ShaderMaterial, type IUniform, Vector2 } from 'three';
import { ShaderFamily, uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { FACADE_PROGRAMS, FACADE_UNIFORMS } from '../data/facadeLook';
import { LOOK_FRAGMENTS, type Shared } from './style';

export type Uniforms = Record<string, IUniform>;

const FACADE_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, FACADE_PROGRAMS);

/** the facade programs' uniforms, built on the clean room's shared ones (one object each) */
export function facadeUniforms(shared: Shared): Uniforms {
  return { ...shared.u, uInk: shared.u.uInk0, uInkFar: shared.u.uInk1, ...uniformsFrom(FACADE_UNIFORMS) };
}

/** the one architecture program; `shrink` = [start, end] metres for small clutter (0 = never) */
export function jiehuaMaterial(shared: Uniforms, opt: { shrink?: readonly [number, number] } = {}): ShaderMaterial {
  return FACADE_FAMILY.material('facade', shared, { uniforms: { uShrink: { value: new Vector2(opt.shrink?.[0] ?? 0, opt.shrink?.[1] ?? 0) } } });
}

// ── windows: interior mapping on a unit quad, scaled to the window (data/facadeLook.ts) ──
export function windowMaterial(shared: Uniforms): ShaderMaterial {
  return FACADE_FAMILY.material('window', shared);
}
