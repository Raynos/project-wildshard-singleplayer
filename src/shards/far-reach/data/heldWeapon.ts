import playback from './heldPlayback.generated.json' with {type:'json'};
import scene from './fanScene.json' with {type:'json'};
import hand from './fanHandScene.json' with {type:'json'};
import { FAN_ROW } from './equipment';
import { FAN_PHASE } from './meleePhase';

/** One held/Explorer assembly, borrowing the optional original hero-hand resources. */
export const FAN_HELD_RECIPE = {equipment:FAN_ROW,phases:FAN_PHASE,playback,scene,
  resources:{reads:[{id:'hand',from:{owner:'hero',path:['read']},args:['hand-hd'],discardGeometry:true}],geometry:[
    {id:'panels',from:{owner:'library',path:['geometry']},args:['shape0'],emptyGeometry:true},
    {id:'sticks',from:{owner:'library',path:['geometry']},args:['shape1'],emptyGeometry:true},
    {id:'straps',from:{owner:'library',path:['geometry']},args:['shape2'],emptyGeometry:true},
    {id:'guards',from:{owner:'library',path:['geometry']},args:['shape3'],emptyGeometry:true},
    {id:'rim',from:{owner:'library',path:['geometry']},args:['shape4'],emptyGeometry:true},
    {id:'plates',from:{owner:'library',path:['geometry']},args:['shape5'],emptyGeometry:true},
    {id:'shape6',from:{owner:'library',path:['geometry']},args:['shape6'],emptyGeometry:true},
    {id:'shape8',from:{owner:'library',path:['geometry']},args:['shape8'],emptyGeometry:true},
    {id:'shape9',from:{owner:'library',path:['geometry']},args:['shape9'],emptyGeometry:true},
    {id:'shape10',from:{owner:'library',path:['geometry']},args:['shape10'],emptyGeometry:true},
    {id:'shape11',from:{owner:'library',path:['geometry']},args:['shape11'],emptyGeometry:true},
    {id:'shape12',from:{owner:'library',path:['geometry']},args:['shape12'],emptyGeometry:true},
    {id:'shape13',from:{owner:'library',path:['geometry']},args:['shape13'],emptyGeometry:true},
  ]},attachments:[{id:'hand',row:hand,parent:'root',requires:'hand',resources:{geometry:[{id:'hand',from:{owner:'library',path:['geometry']},args:['shape7'],emptyGeometry:true}],
    textures:[{id:'hand',from:{owner:'locals',path:['hand','map'],optional:true}}]}}]} as const;
