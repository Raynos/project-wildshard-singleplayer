import perches from '../data/perchRows.generated.json' with { type: 'json' };

const flight={wave:0.7,amplitude:1.2,pitch:0.6,pitchRate:4,bank:-0.5,bankLimit:0.7,bankRate:3};
const depart={distance:140,up:[35,50],speed:11,lift:4,spread:0.6};
const ravenBeat={phase:[3.6,Math.PI*2],amplitude:0.68,foldPhase:0.6,foldAmplitude:0.25,rest:[0.12,0.05],rates:[8,10],glide:[0.8,2.4],beats:[2,5]};
/** a flock row's unused sections (Pine draws its fliers into the wildlife draw and ticks them in world.life) */
const bare={foot:0,wheeling:null,perch:null,guide:null,call:null,attributes:['aAnim','aAnim2'],system:{id:'world.life',after:[],before:[]}};
const visitor={every:20,speed:7.5,lift:2.5,approach:[0,0],cling:0,sag:0,sway:0,stare:0,stareTurn:0,within:110,callCue:null,flushCall:false,gain:0.9,call:null,acts:null,aim:false,depart};

/** Forest wildlife: the ravens at a kill, the owl and the woodpecker as ambient flock rows; the hares; the skinning beat. */
export const PINE_LIFE={kind:'forest-community',seed:0x71fe,
  scavenger:{arrival:[18,52],visitors:{deer:2,boar:2,elk:3,bear:3},defaultVisitors:2,bodyWidths:{deer:0.75,boar:0.6,elk:1.1,bear:0.95},giveUp:240,reach:170,
    flock:{...bare,seed:0x71fd,count:4,scale:1.1,wingbeat:'0',flight,wingbeats:{'0':ravenBeat},visit:null,channels:[['flap','fold','head','peck'],[0,'legs','body',0]],
      scavenge:{arrive:{far:[80,110],up:[30,40],near:9,height:14,speed:10,lift:2},circle:{radius:[7,11],low:[10,15],high:[17,24],speed:[0.45,0.6],timer:[5,9],beat:0.25,call:0.1},
        land:{speed:7,lift:1.5,ring:[0.25,0.7],stand:0.2,pause:[1.5,4],pitch:0.12},
        feed:{pecks:[2,5],pause:[1.2,3.5],hop:0.22,squabble:0.12,rate:5.5,time:[45,80],leave:150,reland:16,look:[1.1,1.4],wings:[-0.08,1],peck:[0.35,0.75,-0.15],hopTime:0.35,hopHeight:0.18},
        flush:[8,12],lift:{up:[9,13],side:4,speed:6,lift:3},depart,voices:{call:'raven_caw',pair:'raven_pair',flap:'raven_flap',gain:0.9,flapGain:0.8,gap:[3,6],flapGap:0.6}}}},
  sentinel:{perches:perches.snags,flock:{...bare,seed:0x71fc,count:1,scale:1.05,wingbeat:'1',flight,scavenge:null,channels:[['flap','fold','head','peck'],[1,'legs','body',0]],
    wingbeats:{'1':{phase:[2.4,Math.PI*2],amplitude:0.75,foldPhase:0.6,foldAmplitude:0.25,rest:[0.12,0.05],rates:[8,10],glide:[1.2,2.6],beats:[2,3]}},
    visit:{...visitor,enter:[0.6,1],stay:[0.4,1],near:[28,70],from:{kind:'behind',back:60,up:12},pose:{pitch:1.1,body:1.1,legs:0,stand:0.16,peck:1.1},sway:0.05,stare:45,stareTurn:2.3,look:[1.6,0.35],
      call:{cue:'owl_hoot',every:[14,28],first:[1.5,4],within:150},flush:14,flushLegs:0,relocate:[30,65],aim:true,leave:120,leaveWait:25}}},
  trunkForager:{perches:perches.bark,flock:{...bare,seed:0x71fb,count:1,scale:1.05,wingbeat:'2',flight,scavenge:null,channels:[['flap','fold','head','peck'],[2,'legs','body',0]],
    wingbeats:{'2':{phase:[11,Math.PI*2],amplitude:0.8,foldPhase:0.6,foldAmplitude:0.25,rest:[-0.05,0.95],rates:[8,10],glide:[0.3,0.3],beats:[3,3]}},
    visit:{...visitor,enter:[0,0.35],stay:[0,0.45],every:15,near:[20,55],from:{kind:'beyond',back:0.8,up:4},speed:8,lift:1.2,approach:[0.6,0.4],cling:1.1,sag:0.25,pose:{pitch:1.3,body:1.3,legs:0.3,stand:0,peck:0.35},look:[0.7,0.8],
      callCue:'woodpecker_call',flushCall:true,gain:0.8,acts:{first:[1,3],every:[3.5,8],hitch:[0.3,0.18],call:0.12,drum:{cue:'woodpecker_drum',length:[0.9,1.4],voiced:1.9,within:60,rate:16,peck:[0.75,0.35]}},
      flush:9,flushLegs:1,relocate:[22,45],leave:110,leaveWait:30}}},
  forager:{model:4,scale:1.12,id:'hare',count:5,place:{kind:'roam',seat:[25,80],reseat:[45,85],range:130,visibleRange:95,retry:2,view:[0.3,0.2,90]},policy:{scare:[12,20],alertMargin:10,releaseMargin:6,alertPause:[2,5],grazePause:[1.5,5],settlePause:[1,3],turn:[-1.2,1.2],grazing:{gait:'hop',chance:0.7,length:[0.3,0.7],duration:0.32,height:0.08},escape:{to:'away',distance:[28,45],pause:[3,6],length:2.4,duration:0.27,height:0.42,zigSteps:[2,4],spread:[-0.7,0.7],steer:0.2},ground:{margin:20,aboveWater:0.35,pond:0.02,cabin:0.05,stream:true,slope:0.86,trunk:0.45},sentry:null,posture:{graze:[0,3,0.55,3,0.35,2],alert:[1,5,-0.3,6,-0.15,6],flee:[0,0,-0.1,8,0.9,8]}}},
  guide:{flock:{seed:0x71ff,count:3,scale:1.1,foot:0,wingbeat:'0',flight,wingbeats:{'0':ravenBeat},wheeling:null,perch:null,
    guide:{speed:10,borrow:0,start:[5,4,3.7],pass:[28,0,4.75],end:{min:170,max:170,up:22},formation:[[0,0,0],[1.2,-1.5,0.3],[1.6,1.5,-0.3]],stagger:0.14,call:null,bank:-0.5,after:null},call:null,scavenge:null,visit:null,
    channels:[['flap','fold','head',0],[0,'legs',0,1]],attributes:['aAnim','aAnim2'],system:{id:'world.life.guide',after:['world.life'],before:['first hints','main.frame']}},
    policy:{distance:'centre',min:40,max:450,schedule:{kind:'periodic',initial:25,period:[90,150]}}},
  harvest:{len:1.5,kneelIn:0.3,cuts:[0.42,0.86],rise:1.15},
  system:{id:'world.life',ambient:'shard.pine.life',after:['shard.pine.weather'],before:['first hints','main.frame']},debug:{id:'pineLife',window:'__pineLife'},
  sounds:{pair:'raven_pair',call:'raven_caw',flap:'raven_flap',hoot:'owl_hoot',foragerCall:'woodpecker_call',drum:'woodpecker_drum',cutA:'skinCut-a',cutB:'skinCut-b'}
} as const;
