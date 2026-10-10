import { BLEND_ADD_KEEP_ALPHA as PLATFORM_BLEND_ADD_KEEP_ALPHA, BLEND_KEEP_ALPHA as PLATFORM_BLEND_KEEP_ALPHA, ShaderFamily as PlatformShaderFamily, setUniforms as platformSetUniforms, uniformsFrom as platformUniformsFrom, type BlendRow as PlatformBlendRow, type ShaderMaterialOptions as PlatformShaderMaterialOptions, type ShaderProgramRow as PlatformShaderProgramRow, type SideRow as PlatformSideRow, type UniformMap as PlatformUniformMap, type UniformRow as PlatformUniformRow, type UniformRows as PlatformUniformRows, type UniformsOf as PlatformUniformsOf, type UniformValueOf as PlatformUniformValueOf } from '@wildshard/game/systems/looks/shaderFamily';

/** One uniform as data: a float, a hex colour, a vector, or an array of vectors or colours. */
export type UniformRow = PlatformUniformRow;
/** A table of uniform rows by uniform name. */
export type UniformRows = PlatformUniformRows;
/** The live value a uniform row makes. */
export type UniformValueOf<R> = PlatformUniformValueOf<R>;
/** The live uniforms a row table makes. */
export type UniformsOf<S extends PlatformUniformRows> = PlatformUniformsOf<S>;
/** A material's uniforms. */
export type UniformMap = PlatformUniformMap;
/** A program's blending preset. */
export type BlendRow = PlatformBlendRow;
/** A program's faces. */
export type SideRow = PlatformSideRow;
/** One program as data (SHARD-PLATFORM M3, look-family rows). */
export type ShaderProgramRow = PlatformShaderProgramRow;
/** What a caller adds to one material. */
export type ShaderMaterialOptions = PlatformShaderMaterialOptions;
/** The live uniforms of a row table. */
export const uniformsFrom: typeof platformUniformsFrom = platformUniformsFrom;
/** Writes a preset into live uniforms in place. */
export const setUniforms: typeof platformSetUniforms = platformSetUniforms;
/** Colour blends over, the target's alpha stays. */
export const BLEND_KEEP_ALPHA: typeof PLATFORM_BLEND_KEEP_ALPHA = PLATFORM_BLEND_KEEP_ALPHA;
/** Colour adds, the target's alpha stays. */
export const BLEND_ADD_KEEP_ALPHA: typeof PLATFORM_BLEND_ADD_KEEP_ALPHA = PLATFORM_BLEND_ADD_KEEP_ALPHA;
/** A shard's shader look family: its GLSL fragments and program rows; builds spliced sources and materials. */
export const ShaderFamily: typeof PlatformShaderFamily = PlatformShaderFamily;
/** A shader look family. */
export type ShaderFamilyView<P extends string = string> = PlatformShaderFamily<P>;
