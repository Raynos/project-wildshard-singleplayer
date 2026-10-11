import type { AnimalSim } from '../entities/AnimalSim';
import { StalkerBrain, type CirclingPackPhase, type CirclingPackPrey, type CirclingPackSpec, type CirclingPackContext, type CirclingPackPorts } from './stalker';

/** Historical circling-pack phase names. */
export type PackPhase = CirclingPackPhase;
/** Host-owned prey identity and authoritative contact recipe. */
export type PackPrey = CirclingPackPrey;
/** Historical bounded pack tuning, preserving all native continuation fields. */
export type PackSpec = CirclingPackSpec;
/** Historical caller-owned decision/body observations. */
export type PackContext<A extends AnimalSim> = CirclingPackContext<A>;
/** Native shared sensing, terrain, tokens and strike authority. */
export type PackPorts<A extends AnimalSim> = CirclingPackPorts<A>;
/** Legacy constructor selecting the stalker core's real-roster pack pattern. */
export class PackBrain<A extends AnimalSim> extends StalkerBrain<A> {
  constructor(members: A[], homeX: number, homeZ: number, spec: PackSpec, ports: PackPorts<A>) {
    super({ pattern: 'pack', members, home: { x: homeX, z: homeZ }, spec, ports });
  }
  /** Preserve the original string continuation while the shared core owns every clock and role. */
  override snapshot(): string { return this.snapshotPack(); }
}
