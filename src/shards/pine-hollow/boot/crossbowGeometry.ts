import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import rows from '../data/crossbowPool.generated.json' with {type:'json'};
/** Immutable templates; weapon meshes borrow these without cloning or changing their channels. */
export const CROSSBOW_GEOMETRY=createModelLibrary({meshes:[],meshUrls:{},hd:[],hdUrls:{},aoFloor:1,hdLooks:{},geometryPools:[rows.pool]},'[pine-hollow held pool]');
