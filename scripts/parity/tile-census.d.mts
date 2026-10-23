/** Capacities and claims are separate observations, never added to physical RAM. */
export function summarizeTileCensus(input: unknown, globalOwners?: readonly string[]): {
  gpu: { engine: number; shardGlobal: number; tileCandidate: number; shared: number; unknown: number };
  total: number; ramCapacity: number; allocatorClaims: number | null;
};
