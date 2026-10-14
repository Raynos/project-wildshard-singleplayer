/** Original island voice controls, including alternating feet and warm order. */
export const ISLAND_FAMILIES = [
 'step-sand','step-planks','step-grass','step-wetSand','step-rock','step-water','step-stone',
 'whoosh','impact-flesh','hurt','impact-shell','impact-wood','impact-stone','whoosh-heavy',
 'vocal-boar','vocal-crab','vocal-monkey','vocal-sailor','windup-boar','windup-crab','windup-sailor',
 'plunge-down','plunge-up','death','ui-chime','ui-chest','ui-locked','ui-lever','ui-plate','ui-door','ui-grate','ui-glyph','ui-ignite'
] as const;
export const ISLAND_PLAYBACK = {
 mode:'voices',initial:{side:1},prewarm:ISLAND_FAMILIES,tables:{
  step:{sand:0.34,wetSand:0.36,grass:0.3,rock:0.34,planks:0.42,stone:0.36,water:0.34},
  vocal:{boar:0.75,crab:0.6,monkey:0.5,sailor:0.85},windup:{boar:0.7,crab:0.65,sailor:0.7},
  interact:{chest:0.7,locked:0.6,lever:0.7,plate:0.65,door:0.7,grate:0.6,chime:0.45,glyph:0.6,ignite:0.8}
 },actions:{
  step:{family:{prefix:'step-',param:'surface'},warm:true,state:[['side',['*',-1,'state.side']]],values:[['k',['clamp',['/','speed',7.2],0.2,1.15]],['gain',['*','step.surface',['+',0.35,['*',0.65,'k']]]],['rate',['+',0.9,['*',0.14,'k']]]],options:[['gain','gain'],['rate','rate'],['pan',['*','state.side',0.12]]]},
  whoosh:{family:{prefix:'whoosh'},state:[],values:[['s',['clamp','speed',0,1]]],options:[['gain',['+',0.22,['*',0.3,'s']]],['rate',['+',0.82,['*',0.38,'s']]],['pan',['*',-0.4,'dir']],['panTo',['*',0.4,'dir']]]},
  heavy:{family:{prefix:'whoosh-heavy'},state:[],values:[['s',['clamp','speed',0,1]]],options:[['gain',['+',0.45,['*',0.2,'s']]],['rate',['+',0.9,['*',0.15,'s']]],['pan',['*',-0.35,'dir']],['panTo',['*',0.35,'dir']]]},
  impact:{family:{prefix:'impact-',param:'material'},state:[],values:[['s',['clamp','strength',0,1]]],options:[['gain',['+',0.4,['*',0.45,'s']]],['rate',['-',1.04,['*',0.1,'s']]]]},
  vocal:{family:{prefix:'vocal-',param:'enemy'},state:[],values:[],options:[['gain',['*','vocal.enemy',['clamp','intensity',0.2,1.3]]]]},
  windup:{family:{prefix:'windup-',param:'enemy'},state:[],values:[],options:[['gain','windup.enemy']]},
  interact:{family:{prefix:'ui-',param:'sound'},state:[],values:[],options:[['gain',['*','interact.sound','gain',['if','release',0.6,1]]],['rate',['if','release',1.18,1]],['delay','delay'],['jitter','jitter']]},
  plunge:{family:{prefix:'plunge-',param:'direction'},state:[],values:[],options:[['gain',['if','up',0.35,0.5]]]}
 }
} as const;
