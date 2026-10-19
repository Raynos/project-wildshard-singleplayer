import { heldGraphFiles } from './heldGraphFiles';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import meshes from '../data/heldProfile.generated.json' with { type: 'json' };
import pendants from '../data/heldPendants.json' with { type: 'json' };
import decals from '../data/decals.json' with { type: 'json' };

/** Complete held draw recipe; runtime code never imports authoring JSON. */
export function heldView(): Readonly<Record<string, unknown>> {
  const scene = parsePrivateScene(pendants);
  const materials = pendants.materials.map(row => row.source);
  const value = { params: heldGraphFiles.params, meshes, pendants: scene, materials, decal: decals.JIAN_DECALS };
  return value;
}
