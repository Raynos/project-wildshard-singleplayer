/** Client observations only; the HUD never receives a horse controller, shard callback or simulation object. */
export interface RideHudState {
  mounted: boolean; breaking: boolean; steed: number; winded: boolean; gait: string; leanLow: number;
  beat: boolean; spurFlash: number; spur: { latched: boolean; streak: number }; horse: string | null;
  mountables: { id: string; name: string; whistle: boolean; hidden: boolean; position: [number, number, number]; scale: number }[];
}
/** Mount tuning, roads, companion rest point and the owner's persisted naming data. */
export interface MountProfile {
  speeds: { walk: number; trot: number; canter: number; gallop: number };
  names: Record<string, string>; restAt?: { x: number; z: number };
  roads?: readonly (readonly (readonly [number, number])[])[];
  thrownDamage: number; thrownLabel: string;
}
/** Actor identity row or its compact id; no controller or actor callbacks enter the riding API. */
export type MountActorRef = string | { readonly entityId: string };
