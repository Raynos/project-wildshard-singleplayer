// The distance LODs' numbers (E283, Jake's pick): where the sculpts' and the crowd's coarser copies start and how far
// their surface may stray there (px on the phone frame, @wildshard/sdk/cull/meshLod `PX_PER_M`).

/** a sculpt's LOD error where it starts, in pixels of the phone frame (E283: the lion's, the Fei Zhua hook's) */
export const SCULPT_PX = 0.7;

/** the crowd (dome B): full detail inside LOD_NEAR m, the clustered far copy past it, nothing past LOD_FAR (the silk fog
 *  has swallowed them) */
export const LOD_NEAR = 35, LOD_FAR = 130;
/** the far copy's triangle cap */
export const LOD_TRIS = 320;
/** (E283) the middle levels' starts (m) and their error there (px on the phone frame) */
export const MID_FROM = [12, 22] as const;
export const MID_PX = 0.8;

/** the crowd's culling levels (@wildshard/sdk/cull/figureCrowd): each figure a 1.3 m sphere 1 m above its feet, its
 *  meshes named `crowd` for the budget ruler */
export const CROWD_LEVELS = { near: LOD_NEAR, far: LOD_FAR, mids: MID_FROM, radius: 1.3, lift: 1, name: 'crowd' } as const;
