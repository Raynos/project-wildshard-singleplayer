import { decodeMeshCollision } from '@wildshard/format/meshCollisionBytes';
import { meshCollisionRules, type CollisionSource } from '@wildshard/format/meshCollision';

/** Verify bounded WMC1 bytes and exact tile containment after immutable hashes and costs have been admitted. */
export function validateMeshCollisionAssets(source: CollisionSource, assets: ReadonlyMap<string, Uint8Array>): void {
  const errors = meshCollisionRules(source); if (errors.length > 0) throw new Error(errors.join('; '));
  const data = source.meshCollision; if (data === null) return;
  for (const row of [...data.tiles, ...data.panels]) {
    const bytes = assets.get(row.file); if (bytes === undefined) throw new Error('Missing mesh collision asset');
    const mesh = decodeMeshCollision(bytes);
    if ('x' in row) {
      const minX = -250 + row.x * 62.5, minZ = -250 + row.z * 62.5;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const x = mesh.vertices[i], z = mesh.vertices[i + 2];
        if (x === undefined || z === undefined || x < minX || x > minX + 62.5 || z < minZ || z > minZ + 62.5) throw new Error('Mesh collision geometry outside declared tile');
      }
    }
  }
}
