import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import rows from '../data/crossbowPool.generated.json' with {type:'json'};
import hands from '../data/handsPool.generated.json' with {type:'json'};
/** Immutable templates; weapon meshes borrow these without cloning or changing their channels: the crossbow's parts and
 *  the hunter's baked hands with the Longbow's (boot/handsGeometry.ts). */
export const CROSSBOW_GEOMETRY=createModelLibrary({meshes:[],meshUrls:{},hd:[],hdUrls:{},aoFloor:1,hdLooks:{},geometryPools:[rows.pool,hands.pool]},'[pine-hollow held pool]');
