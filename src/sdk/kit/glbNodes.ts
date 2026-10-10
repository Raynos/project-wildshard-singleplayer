import { loadGlbNodes as platformLoadGlbNodes, nodeGeometry as platformNodeGeometry, trimeshDesc as platformTrimeshDesc, type GlbNodeAttributes as PlatformGlbNodeAttributes } from '@wildshard/game/systems/kit/glbNodes';

/** The attribute names a kit's program reads its vertex colour (vec4) and its first UV (vec2) under (SHARD-PLATFORM M3, the kit system). */
export type GlbNodeAttributes = PlatformGlbNodeAttributes;
/** One GLB node's geometry: float position / normal, the colour and UV under the kit's names, its matrix applied. */
export const nodeGeometry: typeof platformNodeGeometry = platformNodeGeometry;
/** Every mesh node of a GLB kit by node name, as float geometries in the file's frame. */
export const loadGlbNodes: typeof platformLoadGlbNodes = platformLoadGlbNodes;
/** A placed geometry as a static trimesh collider. */
export const trimeshDesc: typeof platformTrimeshDesc = platformTrimeshDesc;
