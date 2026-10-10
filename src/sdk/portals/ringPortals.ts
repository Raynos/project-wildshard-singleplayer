import {
  edgeArrival as platformEdgeArrival, edgePortals as platformEdgePortals, exitNodeId as platformExitNodeId, exitRoad as platformExitRoad,
  inRingPortal as platformInRingPortal, ringPortalLinks as platformRingPortalLinks, yawAlong as platformYawAlong,
  type EdgePortal as PlatformEdgePortal, type PortalLinkRow as PlatformPortalLinkRow, type PortalNodeRow as PlatformPortalNodeRow,
  type Pose as PlatformPose, type RingPortal as PlatformRingPortal, type RingPortalPlan as PlatformRingPortalPlan,
  type RingTrigger as PlatformRingTrigger, type ShardEdge as PlatformShardEdge,
} from '@wildshard/game/systems/portals/ringPortals';

/** A cell edge, as the shardfile names them (north is +z). */
export type ShardEdge = PlatformShardEdge;
/** One floating ring portal: where it stands and the way a walker crosses it. */
export type RingPortal = PlatformRingPortal;
/** A road edge's ring, with its edge and the edge midpoint. */
export type EdgePortal = PlatformEdgePortal;
/** A ring's walk-in volume. */
export type RingTrigger = PlatformRingTrigger;
/** A player pose: feet and yaw. */
export type Pose = PlatformPose;
/** One portal node in the format's shape. */
export type PortalNodeRow = PlatformPortalNodeRow;
/** One entry's declared portal link in the format's shape. */
export type PortalLinkRow = PlatformPortalLinkRow;
/** What a shard's portal links are written from. */
export type RingPortalPlan = PlatformRingPortalPlan;
/** The yaw that looks along (dx, dz) (SHARD-PLATFORM M3). */
export const yawAlong: typeof platformYawAlong = platformYawAlong;
/** The four road rings at a cell's edge midpoints (SHARD-PLATFORM M3). */
export const edgePortals: typeof platformEdgePortals = platformEdgePortals;
/** Arriving at a road ring: out of the ring, facing out along the road (SHARD-PLATFORM M3). */
export const edgeArrival: typeof platformEdgeArrival = platformEdgeArrival;
/** Whether feet are inside a ring's walk-in volume (SHARD-PLATFORM M3). */
export const inRingPortal: typeof platformInRingPortal = platformInRingPortal;
/** The road the way out leads back to (SHARD-PLATFORM M3). */
export const exitRoad: typeof platformExitRoad = platformExitRoad;
/** The way out's exit node bound back to one road (SHARD-PLATFORM M3). */
export const exitNodeId: typeof platformExitNodeId = platformExitNodeId;
/** Each road's declared portal link in the format's shape (SHARD-PLATFORM M3). */
export const ringPortalLinks: typeof platformRingPortalLinks = platformRingPortalLinks;
