/** Forest wildlife population, roles, sound loans and retained timeline. */
export const PINE_LIFE={kind:'forest-community',seed:0x71fe,
  scavenger:{model:0,count:4,scale:1.1,stand:0.2,flush:8,flushRun:12,reland:16,arrival:[18,52],visitors:{deer:2,boar:2,elk:3,bear:3},defaultVisitors:2,bodyWidths:{deer:0.75,boar:0.6,elk:1.1,bear:0.95},giveUp:240},
  sentinel:{model:1,scale:1.05,stand:0.16},trunkForager:{model:2},forager:{model:4,count:5,scale:1.12,range:130,visibleRange:95},
  guide:{count:3,policy:{distance:'centre',min:40,max:450,schedule:{kind:'periodic',initial:25,period:[90,150]}}},
  flight:{wave:0.7,amplitude:1.2,pitch:0.6,pitchRate:4,bank:-0.5,bankLimit:0.7,bankRate:3},
  harvest:{len:1.5,kneelIn:0.3,cuts:[0.42,0.86],rise:1.15},
  system:{id:'world.life',ambient:'shard.pine.life',after:['shard.pine.weather'],before:['first hints','main.frame']},debug:{id:'pineLife',window:'__pineLife'},
  sounds:{pair:'raven_pair',call:'raven_caw',flap:'raven_flap',hoot:'owl_hoot',foragerCall:'woodpecker_call',drum:'woodpecker_drum',cutA:'skinCut-a',cutB:'skinCut-b'},taps:{knock:'pineLife.knock',drum:'pineLife.drum',perch:'pineLife.woodpecker'}
} as const;
export const LIFE_CAPACITY=PINE_LIFE.scavenger.count+PINE_LIFE.guide.count+PINE_LIFE.forager.count+2;
