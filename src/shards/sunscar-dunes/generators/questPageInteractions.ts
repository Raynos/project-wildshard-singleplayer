import { FLAG } from './rows/flags';
import STRINGS from '../data/strings.json' with { type: 'json' };

/** Page beats for the same admitted logbook, well and crank rules. */
export const SIGNAL_QUEST_PAGE_INTERACTIONS={prompts:[
  {id:'logbook',label:STRINGS.readLog,at:{owner:'caravan',path:['logbookAt']},radius:2.4},
  {id:'fire',label:STRINGS.light,at:{owner:'tower',path:['brazierAt']},radius:2.6},
  {id:'brazier.0',label:STRINGS.needOil,at:{owner:'parts',path:['bowlAt']},radius:3},
  {id:'brazier.1',label:STRINGS.needOil,at:{owner:'parts',path:['bowlAt']},radius:3},
  {id:'brazier.2',label:STRINGS.needOil,at:{owner:'parts',path:['bowlAt']},radius:3},
],bindings:{
  prompts:[{target:'logbook',owner:'world',path:['logbook','onInteract']},{target:'well',owner:'world',path:['well','spot','onInteract']},
    ...[0,1,2].map(i=>({target:`pour.${String(i)}`,owner:'world',path:['braziers',i,'spot','onInteract']})),
    {target:'fire',owner:'world',path:['fire','brazier','onInteract']}],
  labels:[{target:'signal',owner:'world',path:['fire','brazier','label']},{target:'logbook',owner:'world',path:['logbook','label']},{target:'well',owner:'world',path:['well','spot','label']},
    {target:'brazier.0',owner:'world',path:['braziers',0,'spot','label']},{target:'brazier.1',owner:'world',path:['braziers',1,'spot','label']},{target:'brazier.2',owner:'world',path:['braziers',2,'spot','label']}],
  visible:[{target:'jar',owner:'world',path:['well','jar','visible']},
    {target:'oil.0',owner:'world',path:['braziers',0,'parts','oil','visible']},
    {target:'oil.1',owner:'world',path:['braziers',1,'parts','oil','visible']},
    {target:'oil.2',owner:'world',path:['braziers',2,'parts','oil','visible']}],
  calls:[{target:'haul',owner:'motion',path:['runtime','command'],args:['sunscar.well.bucket',1],optional:true},
    {target:'summon',owner:'world',path:['fire','onLight'],optional:true}],
},actions:[
  {id:'logbook',interaction:'logbook',after:[{kind:'label',target:'logbook',text:STRINGS.logRead},{kind:'toast',text:STRINGS.logText}]},
  {id:'well',interaction:'well',denied:{unraised:STRINGS.wellHint},after:[
    {kind:'visible',target:'jar',value:false},{kind:'label',target:'well',text:STRINGS.oilTaken},{kind:'toast',text:STRINGS.oilGot}]},
  {id:'crank',interaction:'crank',after:[{kind:'call',target:'haul'},{kind:'label',target:'well',text:STRINGS.takeOil}]},
  {id:'pour.0',interaction:'pour.0',denied:{missing:STRINGS.needOilHint},after:[{kind:'visible',target:'oil.0',value:true},{kind:'label',target:'brazier.0',text:STRINGS.crackToLight},{kind:'toast',text:STRINGS.crackToLight}]},
  {id:'light.0',interaction:'light.0',before:[{kind:'emitter',target:'brazier.0',value:true},{kind:'label',target:'brazier.0',text:STRINGS.waymarkLit}],after:[{kind:'toast',text:STRINGS.waymarkLit,progress:{flags:['lit.0','lit.1','lit.2'],complete:STRINGS.allLit}}]},
  {id:'pour.1',interaction:'pour.1',denied:{missing:STRINGS.needOilHint},after:[{kind:'visible',target:'oil.1',value:true},{kind:'label',target:'brazier.1',text:STRINGS.crackToLight},{kind:'toast',text:STRINGS.crackToLight}]},
  {id:'light.1',interaction:'light.1',before:[{kind:'emitter',target:'brazier.1',value:true},{kind:'label',target:'brazier.1',text:STRINGS.waymarkLit}],after:[{kind:'toast',text:STRINGS.waymarkLit,progress:{flags:['lit.0','lit.1','lit.2'],complete:STRINGS.allLit}}]},
  {id:'pour.2',interaction:'pour.2',denied:{missing:STRINGS.needOilHint},after:[{kind:'visible',target:'oil.2',value:true},{kind:'label',target:'brazier.2',text:STRINGS.crackToLight},{kind:'toast',text:STRINGS.crackToLight}]},
  {id:'light.2',interaction:'light.2',before:[{kind:'emitter',target:'brazier.2',value:true},{kind:'label',target:'brazier.2',text:STRINGS.waymarkLit}],after:[{kind:'toast',text:STRINGS.waymarkLit,progress:{flags:['lit.0','lit.1','lit.2'],complete:STRINGS.allLit}}]},
  {id:'fire',interaction:'fire',denied:{unlit:STRINGS.fireHint},before:[{kind:'emitter',target:'signal',value:true},{kind:'label',target:'signal',text:STRINGS.lit}],after:[{kind:'call',target:'summon'}]},
],initial:[
  {when:{all:[FLAG.lit]},effects:[{kind:'emitter',target:'signal',value:true},{kind:'label',target:'signal',text:STRINGS.lit}]},
  {when:{all:[FLAG.logbook]},effects:[{kind:'label',target:'logbook',text:STRINGS.logRead}]},
  {when:{all:[FLAG.oil]},effects:[{kind:'visible',target:'jar',value:false},{kind:'label',target:'well',text:STRINGS.oilTaken}]},
  {when:{all:[`${FLAG.brazierPrefix}0`]},effects:[{kind:'mark',target:'oiled.0',value:true},{kind:'mark',target:'lit.0',value:true},{kind:'visible',target:'oil.0',value:true},{kind:'emitter',target:'brazier.0',value:true},{kind:'label',target:'brazier.0',text:STRINGS.waymarkLit}]},
  {when:{all:[FLAG.oil],none:[`${FLAG.brazierPrefix}0`]},effects:[{kind:'label',target:'brazier.0',text:STRINGS.pourOil}]},
  {when:{all:[`${FLAG.brazierPrefix}1`]},effects:[{kind:'mark',target:'oiled.1',value:true},{kind:'mark',target:'lit.1',value:true},{kind:'visible',target:'oil.1',value:true},{kind:'emitter',target:'brazier.1',value:true},{kind:'label',target:'brazier.1',text:STRINGS.waymarkLit}]},
  {when:{all:[FLAG.oil],none:[`${FLAG.brazierPrefix}1`]},effects:[{kind:'label',target:'brazier.1',text:STRINGS.pourOil}]},
  {when:{all:[`${FLAG.brazierPrefix}2`]},effects:[{kind:'mark',target:'oiled.2',value:true},{kind:'mark',target:'lit.2',value:true},{kind:'visible',target:'oil.2',value:true},{kind:'emitter',target:'brazier.2',value:true},{kind:'label',target:'brazier.2',text:STRINGS.waymarkLit}]},
  {when:{all:[FLAG.oil],none:[`${FLAG.brazierPrefix}2`]},effects:[{kind:'label',target:'brazier.2',text:STRINGS.pourOil}]},
]} as const;
