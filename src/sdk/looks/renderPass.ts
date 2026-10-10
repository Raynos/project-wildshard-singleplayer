import { RowRenderPass as PlatformRowRenderPass, type CameraTerm as PlatformCameraTerm, type PackTerm as PlatformPackTerm, type PassDrawRow as PlatformPassDrawRow, type PassProgramRow as PlatformPassProgramRow, type PassTargetRow as PlatformPassTargetRow, type RenderPassContext as PlatformRenderPassContext, type RenderPassRow as PlatformRenderPassRow } from '@wildshard/game/systems/looks/renderPass';

/** A camera quantity a pass uniform takes each frame. */
export type CameraTerm = PlatformCameraTerm;
/** One component of a packed pass uniform. */
export type PackTerm = PlatformPackTerm;
/** How one program is used by a render pass. */
export type PassProgramRow = PlatformPassProgramRow;
/** A render pass's target: a share of the frame or of another target. */
export type PassTargetRow = PlatformPassTargetRow;
/** One draw of a render pass. */
export type PassDrawRow = PlatformPassDrawRow;
/** A full-screen render pass as data (SHARD-PLATFORM M3, render-pass rows). */
export type RenderPassRow = PlatformRenderPassRow;
/** What a render pass's caller supplies. */
export type RenderPassContext = PlatformRenderPassContext;
/** A render pass built from a row: its targets, draw order and per-frame uniforms. */
export const RowRenderPass: typeof PlatformRowRenderPass = PlatformRowRenderPass;
/** A render pass built from a row. */
export type RowRenderPassView = PlatformRowRenderPass;
