import { FLAG } from './rows/flags';
import { parseDeclaredQuestPage } from '@wildshard/format/declaredQuestPage';
import STRINGS from '../data/strings.json' with { type: 'json' };

/** Page beats for the same admitted logbook, well and crank rules. */
export const SIGNAL_QUEST_PAGE_INTERACTIONS=parseDeclaredQuestPage({version:1,quest:'sunscar.signal',prompts:[
  {id:'logbook',action:'logbook',label:STRINGS.readLog,at:{point:'caravan.logbook-at'},radius:2.4},
  {id:'well',action:'well',label:STRINGS.wellDown,channel:'sunscar.well.prompt'},
  ...[0,1,2].map(i=>({id:`brazier.${String(i)}`,action:`pour.${String(i)}`,label:STRINGS.needOil,at:{point:`brazier.${String(i)}.bowl-at`},radius:3})),
  {id:'signal',action:'fire',label:STRINGS.light,at:{point:'tower.brazier-at'},radius:2.6},
],actions:[

  {id:'logbook',interaction:'logbook',after:[{kind:'label',prompt:'logbook',text:STRINGS.logRead},{kind:'toast',text:STRINGS.logText}]},
  {id:'well',interaction:'well',denied:{unraised:STRINGS.wellHint},after:[
    {kind:'visible',part:'well.jar',value:false},{kind:'label',prompt:'well',text:STRINGS.oilTaken},{kind:'toast',text:STRINGS.oilGot}]},
  {id:'crank',interaction:'crank',after:[{kind:'mover',id:'sunscar.well.bucket',command:1},{kind:'label',prompt:'well',text:STRINGS.takeOil}]},
  {id:'pour.0',interaction:'pour.0',denied:{missing:STRINGS.needOilHint},after:[{kind:'visible',part:'brazier.0.oil',value:true},{kind:'label',prompt:'brazier.0',text:STRINGS.crackToLight},{kind:'toast',text:STRINGS.crackToLight}]},
  {id:'light.0',interaction:'light.0',before:[{kind:'emitter',target:'brazier.0',value:true},{kind:'label',prompt:'brazier.0',text:STRINGS.waymarkLit}],after:[{kind:'toast',text:STRINGS.waymarkLit,progress:{flags:['lit.0','lit.1','lit.2'],complete:STRINGS.allLit}}]},
  {id:'pour.1',interaction:'pour.1',denied:{missing:STRINGS.needOilHint},after:[{kind:'visible',part:'brazier.1.oil',value:true},{kind:'label',prompt:'brazier.1',text:STRINGS.crackToLight},{kind:'toast',text:STRINGS.crackToLight}]},
  {id:'light.1',interaction:'light.1',before:[{kind:'emitter',target:'brazier.1',value:true},{kind:'label',prompt:'brazier.1',text:STRINGS.waymarkLit}],after:[{kind:'toast',text:STRINGS.waymarkLit,progress:{flags:['lit.0','lit.1','lit.2'],complete:STRINGS.allLit}}]},
  {id:'pour.2',interaction:'pour.2',denied:{missing:STRINGS.needOilHint},after:[{kind:'visible',part:'brazier.2.oil',value:true},{kind:'label',prompt:'brazier.2',text:STRINGS.crackToLight},{kind:'toast',text:STRINGS.crackToLight}]},
  {id:'light.2',interaction:'light.2',before:[{kind:'emitter',target:'brazier.2',value:true},{kind:'label',prompt:'brazier.2',text:STRINGS.waymarkLit}],after:[{kind:'toast',text:STRINGS.waymarkLit,progress:{flags:['lit.0','lit.1','lit.2'],complete:STRINGS.allLit}}]},
  {id:'fire',interaction:'fire',denied:{unlit:STRINGS.fireHint},before:[{kind:'emitter',target:'signal',value:true},{kind:'label',prompt:'signal',text:STRINGS.lit}]},
],initial:[
  {when:{all:[FLAG.lit]},effects:[{kind:'emitter',target:'signal',value:true},{kind:'label',prompt:'signal',text:STRINGS.lit}]},
  {when:{all:[FLAG.logbook]},effects:[{kind:'label',prompt:'logbook',text:STRINGS.logRead}]},
  {when:{all:[FLAG.oil]},effects:[{kind:'visible',part:'well.jar',value:false},{kind:'label',prompt:'well',text:STRINGS.oilTaken}]},
  {when:{all:[`${FLAG.brazierPrefix}0`]},effects:[{kind:'mark',target:'oiled.0',value:true},{kind:'mark',target:'lit.0',value:true},{kind:'visible',part:'brazier.0.oil',value:true},{kind:'emitter',target:'brazier.0',value:true},{kind:'label',prompt:'brazier.0',text:STRINGS.waymarkLit}]},
  {when:{all:[FLAG.oil],none:[`${FLAG.brazierPrefix}0`]},effects:[{kind:'label',prompt:'brazier.0',text:STRINGS.pourOil}]},
  {when:{all:[`${FLAG.brazierPrefix}1`]},effects:[{kind:'mark',target:'oiled.1',value:true},{kind:'mark',target:'lit.1',value:true},{kind:'visible',part:'brazier.1.oil',value:true},{kind:'emitter',target:'brazier.1',value:true},{kind:'label',prompt:'brazier.1',text:STRINGS.waymarkLit}]},
  {when:{all:[FLAG.oil],none:[`${FLAG.brazierPrefix}1`]},effects:[{kind:'label',prompt:'brazier.1',text:STRINGS.pourOil}]},
  {when:{all:[`${FLAG.brazierPrefix}2`]},effects:[{kind:'mark',target:'oiled.2',value:true},{kind:'mark',target:'lit.2',value:true},{kind:'visible',part:'brazier.2.oil',value:true},{kind:'emitter',target:'brazier.2',value:true},{kind:'label',prompt:'brazier.2',text:STRINGS.waymarkLit}]},
  {when:{all:[FLAG.oil],none:[`${FLAG.brazierPrefix}2`]},effects:[{kind:'label',prompt:'brazier.2',text:STRINGS.pourOil}]},
]});
