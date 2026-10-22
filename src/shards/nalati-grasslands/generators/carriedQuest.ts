import kokpar from '../data/kokpar.generated.json' with {type:'json'};
import prop from '../data/questProp.generated.json' with {type:'json'};
import { parseCarriedQuest } from '@wildshard/format/questSteps';

/** The existing round program chooses poses and existing quest service effects. */
export const carriedQuestRows=parseCarriedQuest({
  quest:'tulpar',objectName:'nalati-kokpar-goat',model:[prop],program:kokpar.program,floorWindow:2,step:.1,home:kokpar.home,goals:kokpar.goals,
  state:{carrying:0,left:0,slow:0,cheer:0,warned:0},
  signals:{step:'step',win:'win'},fields:{dt:'dt',playerX:'playerX',playerZ:'playerZ',objectX:'goatX',objectZ:'goatZ',mounted:'mounted',carrier:'horse',fast:'fast',practice:'practice',carrierX:'horseX',carrierZ:'horseZ'},
  outputs:{carrying:'carrying',warning:'warning',pose:'pose',goal:'goal',event:'event'},
  poses:{reset:1,carry:[2,3],goal:3,home:{height:.16,rotation:[0,.7,Math.PI/2-.25]},attached:{out:.62,height:1.02,yaw:Math.PI/2,roll:.35},delivered:{height:.9,rotation:[0,.3,Math.PI/2-.2]}},
  warning:[{kind:'toast',text:kokpar.messages['6']}],
  events:Object.entries(kokpar.messages).filter(([key])=>key!=='6').map(([key,text])=>({value:Number(key),effects:[{kind:'toast',text},{kind:'sting',name:key==='1'?'pickup':key==='7'?'chunk':'death'},...(key==='7'?[{kind:'flag',flag:'won:kokpar'}]:[])]})),
});
