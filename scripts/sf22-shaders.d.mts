/** A raw shader compile call classified only by synchronous renderer.compile nesting. */
export interface ShaderCompileInterval { start: number; end: number; phase: string }
/** A browser Long Task interval; duration is retained rather than inferred from hook wall time. */
export interface ShaderTaskInterval { start: number; end: number; duration: number }
/** Raw counts and the censored task maximum used by the zero draw/driver compile gate. */
export interface ShaderCompilationVerdict {
  totalCalls: number; explicitWarmUpCalls: number; drawOrDriverCalls: number; unclassifiedCalls: number;
  longTasksAvailable: boolean; observerThresholdMs: number; limitMs: number; observedWarmUpTasks: number;
  observedMaxWarmUpTaskMs: number | null; maxWarmUpTaskMsUpperBound: number | null; pass: boolean;
}
/** Exclude explicit warm-up only when its observed task maximum is within budget; absent observation fails. */
export function shaderCompilationGate(compiles: readonly ShaderCompileInterval[], tasks: readonly ShaderTaskInterval[],
  longTasksAvailable: boolean, limitMs?: number): ShaderCompilationVerdict;
