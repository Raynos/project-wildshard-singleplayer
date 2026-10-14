import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import rows from '../data/swordPool.generated.json' with {type:'json'};
/** Immutable templates; weapon meshes borrow these without cloning or changing their channels. */
export const SWORD_GEOMETRY=createModelLibrary({meshes:[],meshUrls:{},hd:[],hdUrls:{},aoFloor:1,hdLooks:{},geometryPools:[rows]},'[driftwood-isle held pool]');
