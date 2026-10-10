import { editPut as platformEditPut, editShader as platformEditShader, editText as platformEditText, type ChunkEditRow as PlatformChunkEditRow, type ShaderEditRow as PlatformShaderEditRow, type ShaderStages as PlatformShaderStages, type TextEditRow as PlatformTextEditRow } from '@wildshard/game/systems/looks/shaderEdits';

/** One text edit: a string (or a RegExp source when `flags` is set) replaced (SHARD-PLATFORM M3, look-family rows). */
export type TextEditRow = PlatformTextEditRow;
/** One of three's shader chunks with its own text edits. */
export type ChunkEditRow = PlatformChunkEditRow;
/** One edit of a program stage as data: the first `find` replaced by `put` (text, or an edited chunk). */
export type ShaderEditRow = PlatformShaderEditRow;
/** The two sources an `onBeforeCompile` patch edits. */
export type ShaderStages = PlatformShaderStages;
/** A source with one text edit applied. */
export const editText: typeof platformEditText = platformEditText;
/** The replacement text a row puts. */
export const editPut: typeof platformEditPut = platformEditPut;
/** Applies shader edit rows to a program's stages in their written order (inside a `patchShader` callback). */
export const editShader: typeof platformEditShader = platformEditShader;
