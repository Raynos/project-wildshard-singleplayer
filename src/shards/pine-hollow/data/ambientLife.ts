import perches from './perches.generated.json';

/** Forest wildlife population, roles, sound loans and retained timeline. */
export const PINE_LIFE={kind:'forest-community',seed:0x71fe,
  scavenger:{model:0,count:4,scale:1.1,stand:0.2,flush:8,flushRun:12,reland:16,arrival:[18,52],visitors:{deer:2,boar:2,elk:3,bear:3},defaultVisitors:2,bodyWidths:{deer:0.75,boar:0.6,elk:1.1,bear:0.95},giveUp:240},
  perches,
  sentinel:{model:1,scale:1.05,stand:0.16},trunkForager:{model:2},forager:{model:4,count:5,scale:1.12,range:130,visibleRange:95,policy:{scare:[12,20],alertMargin:10,releaseMargin:6,alertPause:[2,5],grazePause:[1.5,5],settlePause:[1,3],turn:[-1.2,1.2],grazing:{gait:'hop',chance:0.7,length:[0.3,0.7],duration:0.32,height:0.08},escape:{to:'away',distance:[28,45],pause:[3,6],length:2.4,duration:0.27,height:0.42,zigSteps:[2,4],spread:[-0.7,0.7],steer:0.2},ground:{margin:20,aboveWater:0.35,pond:0.02,cabin:0.05,stream:true,slope:0.86,trunk:0.45},sentry:null,posture:{graze:[0,3,0.55,3,0.35,2],alert:[1,5,-0.3,6,-0.15,6],flee:[0,0,-0.1,8,0.9,8]}}},
  guide:{flock:{seed:0x71ff,count:3,scale:1.1,foot:0,wingbeat:'0',flight:{wave:0.7,amplitude:1.2,pitch:0.6,pitchRate:4,bank:-0.5,bankLimit:0.7,bankRate:3},
    wingbeats:{'0':{phase:[3.6,Math.PI*2],amplitude:0.68,foldPhase:0.6,foldAmplitude:0.25,rest:[0.12,0.05],rates:[8,10],glide:[0.8,2.4],beats:[2,5]}},wheeling:null,perch:null,
    guide:{speed:10,borrow:0,start:[5,4,3.7],pass:[28,0,4.75],end:{min:170,max:170,up:22},formation:[[0,0,0],[1.2,-1.5,0.3],[1.6,1.5,-0.3]],stagger:0.14,call:null,bank:-0.5,after:null},call:null,
    channels:[['flap','fold','head',0],[0,'legs',0,1]],attributes:['aAnim','aAnim2'],system:{id:'world.life.guide',after:['world.life'],before:['first hints','main.frame']}},
    policy:{distance:'centre',min:40,max:450,schedule:{kind:'periodic',initial:25,period:[90,150]}}},
  flight:{wave:0.7,amplitude:1.2,pitch:0.6,pitchRate:4,bank:-0.5,bankLimit:0.7,bankRate:3},
  wingbeats:{
    '0':{phase:[3.6,Math.PI*2],amplitude:0.68,foldPhase:0.6,foldAmplitude:0.25,rest:[0.12,0.05],rates:[8,10],glide:[0.8,2.4],beats:[2,5]},
    '1':{phase:[2.4,Math.PI*2],amplitude:0.75,foldPhase:0.6,foldAmplitude:0.25,rest:[0.12,0.05],rates:[8,10],glide:[1.2,2.6],beats:[2,3]},
    '2':{phase:[11,Math.PI*2],amplitude:0.8,foldPhase:0.6,foldAmplitude:0.25,rest:[-0.05,0.95],rates:[8,10],glide:[0.3,0.3],beats:[3,3]},
  },
  harvest:{len:1.5,kneelIn:0.3,cuts:[0.42,0.86],rise:1.15},
  system:{id:'world.life',ambient:'shard.pine.life',after:['shard.pine.weather'],before:['first hints','main.frame']},debug:{id:'pineLife',window:'__pineLife'},
  sounds:{pair:'raven_pair',call:'raven_caw',flap:'raven_flap',hoot:'owl_hoot',foragerCall:'woodpecker_call',drum:'woodpecker_drum',cutA:'skinCut-a',cutB:'skinCut-b'},taps:{knock:'pineLife.knock',drum:'pineLife.drum',perch:'pineLife.woodpecker'}
} as const;
