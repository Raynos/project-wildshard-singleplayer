// SHARD-PLATFORM M3 (look-family rows): Driftwood's herring gull palette and its flock row (@wildshard/game/ambient/ambientFlock).
export const GULL_PALETTE = {
  white: '#f3f3ef',
  belly: '#ffffff',
  grey: '#b4bac0',
  greyDark: '#9aa1a8',
  tip: '#2b2e33',
  beak: '#e9a23b',
  leg: '#e08a3a',
  eye: '#1a1a1a',
};
/** the beach perches keep off the pier corridors: |x| < `half` beyond |z| > `beyond`, and the same across */
export const GULL_CORRIDORS = { half: 8, beyond: 150 };

/** The gull flock row (G466 H6, @wildshard/game/ambient/ambientFlock): perched on the pier, boat, rocks and sand, wheeling in three
 *  loose loops over the lagoon, flushed within ~4 m, and the place guide's V (E309 B); the rig is (flap, head, fold, legs). */
export const GULL_FLOCK={seed:0xcfb0,count:36,scale:1.3,foot:0.221,wingbeat:'gull',
  flight:{wave:0,amplitude:0,pitch:0.7,pitchRate:4,bank:0.9,bankLimit:0.75,bankRate:2.5,directionEpsilon:1e-4},
  wingbeats:{gull:{phase:[3.6,Math.PI,2],amplitude:0.75,foldPhase:0.6,foldAmplitude:0.5,rest:[0.14,0.12],rates:[6,6],glide:[1.5,5],beats:[2,6]}},
  wheeling:{centre:{x:0,z:-205},radius:90,loops:[[0,0],[-0.5,0.35],[0.55,-0.25]],loopRadius:[0.32,0.48],speed:[9,11],altitude:[18,30],bodyScale:[0.75,1.2],bodyAltitude:[-4,8],perchAfter:[20,40],bank:0.9,
    wheel:{xAmplitude:0.22,xFrequency:2,zScale:0.85,zAmplitude:0.18,zFrequency:3,altitudeFrequency:0.45,altitudeAmplitude:3.5,detailFrequency:1.7,detailAmplitude:1.2}},
  perch:{share:0.6,flush:4,flushJitter:[0.8,1.25],settle:0.6,clear:10,idle:[1.5,5],every:[3,9],hop:{chance:0.5,duration:0.36,height:0.14,turn:0.9},head:{rate:0.9,range:1.1,duration:[0.25,0.5]},
    takeoff:{duration:2.6,out:5,up:3.5,beats:8,bank:0.35},landing:{speed:9,minimum:2.5,rise:4,flare:0.82,bank:0.5}},
  guide:{speed:12,borrow:60,start:[30,3,14],pass:[6,4,10],end:{min:40,max:120,up:20},formation:[[0,0,0],[3.5,-3,-0.6],[3.5,3,-0.6]],stagger:0,call:0.4,bank:0.5,after:{ahead:60,up:14,speed:10}},
  call:{cue:'cue.ambient.gull',every:[5,12],first:6},scavenge:null,visit:null,
  channels:[['flap','head','fold','legs'],null],attributes:['aAnim',null],
  system:{id:'shard.driftwood.gulls',after:[],before:['main.world']},
};
