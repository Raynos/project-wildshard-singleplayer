import { defineMountedSpecimen } from '@wildshard/game/models/mountedSpecimen';
import mountedSpecimen from '../boot/mountedSpecimen.json' with { type: 'json' };

/** the mounted shepherd: his seated figure on the saddled camp horse's body bone, as the raid seats him (the horse is the
 *  Hunyuan3D-2 saddled hull on the horse's rig, the code horse until it loads; he is code). The camp's five are a kit
 *  figure card of merged atlases (generators/explorerCatalogue.ts, G601 C5). */
export const shepherd = defineMountedSpecimen(mountedSpecimen);
