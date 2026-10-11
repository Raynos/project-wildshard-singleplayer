/** Existing named-place discovery rows and guide thresholds; native POI resolution and guide clocks stay trusted. */
interface PlaceDef { id: string; label: string; at: { poi: 'world' | 'hut' | 'lookout' | 'wreck' | 'shrine' | 'cave' | 'pier'; x: number; z: number; anchor?: string }; r: number }

/** The nine places (E318, Jake: the N and W jetties stay — "we need these landings for the shardfile requirements" — but
 *  they lead to empty beach, so they are not places: no map pin, no gull guide there, not on the complete card) */
export const DRIFTWOOD_PLACES: PlaceDef[] = [
  { id: 'pier', label: 'THE PIER', at: { poi: 'world', x: 0, z: -215 }, r: 40 },
  { id: 'hut', label: 'WENDELL\'S HUT', at: { poi: 'hut', x: 0, z: -2 }, r: 26 },
  { id: 'vista', label: 'VISTA POINT', at: { poi: 'world', x: -46, z: -100 }, r: 14 },
  { id: 'bridge', label: 'ROPE BRIDGE', at: { poi: 'world', x: 24, z: 22 }, r: 18 },
  { id: 'zipline', label: 'ZIPLINE', at: { poi: 'lookout', anchor: 'lookout.zipline', x: 20, z: -30 }, r: 12 },
  { id: 'lookout', label: 'THE LOOKOUT', at: { poi: 'lookout', x: 0, z: 0 }, r: 24 },
  { id: 'wreck', label: 'WRECK COVE', at: { poi: 'wreck', x: 0, z: 0 }, r: 30 },
  { id: 'cave', label: 'SEA CAVE', at: { poi: 'cave', x: 0, z: -4 }, r: 16 },
  { id: 'shrine', label: 'RING SHRINE', at: { poi: 'shrine', x: 0, z: 0 }, r: 26 },
];


/** Original wander/idle/cooldown thresholds for the native guide. */
export const GUIDE = {
  /** seconds of wandering with no progress before the gulls show the way */
  wander: 50,
  /** seconds standing still before they do */
  idle: 10,
  /** m/s: slower than this is standing still */
  idleSpeed: 0.4,
  /** seconds between two guides */
  cooldown: 90,
  /** seconds before trying again when no gull could fly (all busy / none far enough to borrow) */
  retry: 8,
} as const;

