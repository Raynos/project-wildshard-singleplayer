import { PINE_BIRD } from './audioPhrases';
import { parseAudioData } from '@wildshard/sdk/audio';
import { PINE_AUDIO_ZONES, PINE_AUDIO_MIX, PINE_AUDIO_NODES } from './audioZones';
import { PINE_AUDIO_SAMPLES } from './runtimeCost';

/** Existing forest samples, score/boss slots, scoped rifle echo and authored ambience zones. */
export const PINE_AUDIO = parseAudioData({ playback:{mode:'samples',initial:{},prewarm:[],tables:{},actions:{shot:{family:{prefix:'',param:'family'},state:[],values:[],options:[],tap:'pineSfx:'}},sample:{reach:220,scale:10,power:1.3,cutoffScale:30,delay:0.01,jitter:40,outOfRangeHandled:true}}, surfaces:{fallback:'litter',rules:[
  {kind:'floor',source:'cabins',tolerance:0.45,surface:'planks'},
  {kind:'value',source:'rain',op:'gt',threshold:0.3,surface:'wet'},
  {kind:'circle',source:'pond',padding:3.5,surface:'mud'},
  {kind:'value',source:'slope',op:'gt',threshold:0.32,surface:'rock'}]}, observations:[{
  id:'audio',inputs:[
    {id:'hasClock',source:'clock',path:[],op:'present'},{id:'night',source:'clock',path:['night'],op:'number',fallback:0},
    {id:'pinned',source:'pinned',path:[],op:'truth'},{id:'boss',source:'score',path:['sceneName'],op:'equals',value:'boss'},
    {id:'engaged',source:'engaged',path:[],op:'truth'},
    {id:'listener.x',source:'listener',path:['x'],op:'number'},{id:'listener.y',source:'listener',path:['y'],op:'number'},{id:'listener.z',source:'listener',path:['z'],op:'number'}
  ],after:['hud.combat'],before:['shard.pine.weather.state','shard.pine.weather','world.life','first hints','main.frame'],
  interval:0.2,initial:{night:0,elite:0,eliteT:0,snortAt:-99},
  frame:[{write:'ambience.night',value:'night',when:'hasClock'}],
  steps:[
    {kind:'state',id:'night',when:'hasClock',value:['if','state.night',['gt','night',0.35],['gt','night',0.55]],changed:'clock.change'},
    {kind:'call',call:'score.scene',when:['and','hasClock',['not','pinned'],['not','boss']]},
    {kind:'state',id:'elite',value:'engaged',changed:'elite.change'},
    {kind:'call',call:'combat',when:['and','state.elite',['gt',['-','t','state.eliteT'],1]],remember:'eliteT'},
    {kind:'entities',list:'animals',actorKind:'deer',state:'alert',exclude:['alert','flee'],gap:3,radius:70,remember:'snortAt',call:'deer.snort'}
  ]}], cues: [], ambience: { phrases:[PINE_BIRD], bed: 'forest', winds: [
    { frequency:260,q:0.5,pan:-0.55,rate:0.07,gain:0.11 }, { frequency:620,q:0.8,pan:0.55,rate:0.11,gain:0.06 },
    { frequency:140,q:0.4,pan:0,rate:0.05,gain:0.09 }, { frequency:2400,q:0.5,pan:0.2,rate:0.09,gain:0.012 }
  ], gust: { scope:'audio.pine.bed',scopeFirst:false,startTap:'audio.startForest',tap:'audio.gust',gentle:1,wait:[5,12],rise:[1.5,3],fall:[2,4],amount:[0.5,1.6] } }, score: 'default',
  music: { lifecycle:{persistent:true,dispose:false,logChanges:true,bossScene:'boss',deckSting:{exceptSlot:'title',delay:2},pins:{night:{scene:'night'},boss:{scene:'boss'},'boss-2':{scene:'boss',phase:2},'boss-3':{scene:'boss',phase:3},dawn:{sting:'dawn'}}}, catalogue: { mode: 'slots', extraStings: ['dawn'], stingSets: { dawn: 'pine-hollow' } }, id: 'score.pine', base: 'pine', slots: ['pine', 'night', 'boss'], bootSlots: ['title', 'pine'], synthLead: 'pluck', minFade: 0,
    source: null, sets: { pine: 'base', night: 'pine-hollow', boss: 'pine-hollow' }, selectMode: 'first', selection: [
      { slots: ['pine'], when: [{ field: 'scene', op: 'equals', value: 'day' }] },
      { slots: ['night'], when: [{ field: 'scene', op: 'equals', value: 'night' }] },
      { slots: ['boss'], when: [{ field: 'scene', op: 'equals', value: 'boss' }] },
    ] },
  samples: PINE_AUDIO_SAMPLES,
  zones: { routing:{probeFinite:['x','y','z','rawNight','rawDawn','rawRain'],probes:[
    {kind:'footprint',id:'cabin',floor:'cabins',sites:'cabins',minY:0,maxY:3.2,x:[-6,2.45],z:[-6,6]},
    {kind:'circle',id:'pond',source:'pond',inner:4,outer:40,pan:'pond'},
    {kind:'spots',source:'spots',ids:['creek','waterfall','mill','ridge','oldgrowth','cave'],fade:25,open:'open',initial:['gt','pond',0.5],pans:['creek','waterfall','mill']},
    {kind:'maximum',id:'fire',source:'fire',initial:'cabin',inner:2,outer:9,gain:0.55}],warm:[],prewarm:['ir-cabin','ir-bowl'],listener:'port',bounds:[],near:[],steer:[],
    rooms:{from:'sfx',to:'world',input:'sendIn',prewarmMissing:true,list:[
      {id:'cabin',ir:'ir-cabin',weight:'cabin',level:['*','wet.cabin','cabin','dry']},
      {id:'den',ir:'ir-den',weight:'cave',level:['*','wet.den','cave','dry']},
      {id:'oldgrowth',ir:'ir-oldgrowth',weight:'room.oldgrowth',level:['*','wet.oldgrowth','room.oldgrowth','dry']},
      {id:'bowl',ir:'ir-bowl',weight:'room.bowl',level:['*','wet.bowl','room.bowl','dry']} ]},
    zoneNames:['hollow','pond','cabin','creek','waterfall','mill','ridge','oldgrowth','cave'],
    samples:{startDelay:0.05,tap:'forest.bed:',beds:[
      {id:'hollow',out:'occl',panned:false},{id:'pond',out:'occl',panned:true},{id:'cabin',out:'out',panned:false},
      {id:'creek',out:'occl',panned:true},{id:'waterfall',out:'occl',panned:true},{id:'mill',out:'occl',panned:true},
      {id:'ridge',out:'occl',panned:false},{id:'oldgrowth',out:'occl',panned:false},{id:'cave',out:'occl',panned:false},
      {id:'night',out:'occl',panned:false},{id:'nightfog',out:'occl',panned:false},{id:'rain-canopy',out:'occl',panned:false},{id:'rain-open',out:'occl',panned:false},{id:'dawn',out:'occl',panned:false}]},
    activeGains:[['out','out'],['sendIn',1]]}, nodes:PINE_AUDIO_NODES,mix:PINE_AUDIO_MIX, id: 'ambience.pine', smoothSeconds: 0.1, tickHz: 10, silentSeconds: 60, holdSeconds: 0,
    levels: { out: 0.55, hollow: 0.7, pond: 1, cabin: 1.1, creek: 0.9, waterfall: 1.1, mill: 0.9, ridge: 0.9, oldgrowth: 1, cave: 1, night: 0.9, nightfog: 0.7, 'rain-canopy': 1, 'rain-open': 0.9, dawn: 0.9 },
    wet: { cabin: 0.4, den: 0.55, oldgrowth: 0.3, bowl: 0.12 }, zones: PINE_AUDIO_ZONES },
  routing: [
    { id: 'cue.lever.fire', actions: [{ voice: 'pine.leverShot' }, { voice: 'pine.leverEcho', delay: 0.42, overrides: { gain: 0.55 } }] },
    { id: 'cue.lever.dry', actions: [{ voice: 'pine.leverDry' }] },
    { id: 'cue.lever.reload', actions: [] },
    { id: 'cue.lever.cycle', actions: [{ voice: 'pine.leverCycle' }] },
    { id: 'cue.lever.round', actions: [{ voice: 'pine.leverRoundIn', overrides: { gain: 0.9 } }] },
    { id: 'cue.longbow.loose', actions: [{ voice: 'pine.longbowLoose' }] },
    { id: 'cue.longbow.draw', actions: [{ voice: 'pine.longbowDraw', overrides: { gain: 0.8 } }] },
    { id: 'cue.projectile.hit', when: [{ field: 'surface', op: 'equals', value: 'ground' }, { field: 'point', op: 'present' }], actions: [{ voice: 'pine.boltImpact-rock' }] },
  ],
});
