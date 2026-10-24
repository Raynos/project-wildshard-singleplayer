/** Capacities and claims are separate observations, never added to physical RAM. */
export interface SceneCpuSummary {
  totalBytes: number; singleNodeBytes: number; sharedNodeBytes: number; unlinkedBytes: number;
  nodes: number; boundedNodes: number; missingCpuRoles: number;
}
export function summarizeTileCensus(input: unknown, globalOwners?: readonly string[]): {
  gpu: { engine: number; shardGlobal: number; tileCandidate: number; shared: number; unknown: number };
  total: number; ramCapacity: number; allocatorClaims: number | null;
  /** Scene subset only; may overlap ramCapacity. No cache retirement or physical-RAM claim. */
  sceneCpu: SceneCpuSummary | null;
};
