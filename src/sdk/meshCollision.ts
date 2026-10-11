import { parseMeshCollision as parseData } from '@wildshard/format/meshCollision';

/** Compiled exact triangle tiles and independent interactive collider references. */
export type MeshCollisionData = ReturnType<typeof parseData>;
/** Check callback-free collider declarations before compiling an author product. */
export function meshCollision(input: unknown): MeshCollisionData { return parseData(input); }
