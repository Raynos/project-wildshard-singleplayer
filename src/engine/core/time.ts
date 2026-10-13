/**
 * The frame's presentation time. `scale` is the visual hit-stop, `realDt` the frame's real delta, and `t` the frame
 * time (seconds) every system's frame step is handed: deterministic in capture mode (`GameClock.real`), the wall clock
 * live. Graph materials' `time` node reads `t` (`render/nodes/engineNodesHandler.ts`), so a capture (a map bake, a parity
 * proof) draws them where the game's clock has them, not wherever the wall clock had them. `t` is null until the game's
 * frame loop runs (a page without one keeps three's own node clock).
 */
export const worldTime: { scale: number; realDt: number; t: number | null } = { scale: 1, realDt: 0, t: null };
