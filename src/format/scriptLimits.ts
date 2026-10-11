/** Per-level tick allowances shared by every module and entity, not reset by individual calls. */
export interface ScriptLimits { instances: number; memoryBytes: number; effects: number; spawns: number; events: number; queries: number; fuelPerCall: number; fuelPerTick: number; failures: number }
/** Conservative defaults; all are hard platform ceilings and may only be lowered by a host. */
export const SCRIPT_LIMITS: Readonly<ScriptLimits> = Object.freeze({ instances: 8, memoryBytes: 24000000, effects: 128, spawns: 8, events: 32, queries: 64, fuelPerCall: 2000000, fuelPerTick: 8000000, failures: 3 });
