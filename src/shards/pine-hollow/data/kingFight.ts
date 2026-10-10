import type { RoamingBossRow } from '@wildshard/sdk/phasedBoss';
import { KINGS_CLEARING } from '../layout';
import { ANTLER_KING_PHASES } from './antlerKing';
import { KING_ATTACK_TIMING } from '../combat/kingTiming';

/** The shipped Warden fight as phasedBoss data: each stance, contact, lane chain, lantern and phase. */
export const ANTLER_KING_FIGHT = {
  kind: 'roaming', origin: KINGS_CLEARING,
  phases: [
    {at: ANTLER_KING_PHASES[0].at,beginMode:'stalk',chaseSpeed:2.3,recoverySeconds:3.2,burstCooldown:9,summons:false,rings:1,darkness:false},
    {at: ANTLER_KING_PHASES[1].at,beginMode:'stalk',chaseSpeed:2.8,recoverySeconds:2.6,burstCooldown:7.5,summons:true,rings:2,darkness:false,enter:{mode:'stalk',drop:true,summonDelay:1.2}},
    {at: ANTLER_KING_PHASES[2].at,beginMode:'stalk3',chaseSpeed:2.3,recoverySeconds:3.2,burstCooldown:9,summons:true,rings:2,darkness:true,enter:{mode:'stalk3',resetChain:true,roar:true}},
  ],
  modes: {
    dormant:{kind:'idle',damage:0.01}, intro:{kind:'intro',damage:0.25}, dead:{kind:'dead',damage:0.25},
    stalk:{kind:'pursue',damage:0.25}, sweep:{kind:'strike',damage:0.25}, stomp:{kind:'burst',damage:0.25},
    waves:{kind:'wait-rings',damage:0.25}, open:{kind:'recover',damage:0.25}, call:{kind:'summon',damage:0.25}, stalk3:{kind:'lanes',damage:0.25},
  },
  names:{idle:'dormant',intro:'intro',dead:'dead',pursue:'stalk',strike:'sweep',burst:'stomp',wait:'waves',recover:'open',summon:'call'},
  arena:{entry:22,wall:27.5,fog:31,leash:24,wallPad:1,clampPad:1.2,shoveBase:4,shoveGain:8,shoveDistance:2,shoveSpan:2,epsilon:1e-3},
  seal:{inSeconds:2,outSeconds:2.5,darkIn:2.5,darkOut:2},
  opening:{mode:'open',lanesMode:'stalk3',inRate:4,outRate:2.5,inactiveRate:2},
  damage:{invulnerable:0.01,weakOpen:3,weakClosed:0.6,opening:0.5},
  initial:{strikeCd:2,burstCd:4,summonCd:0}, recoveryTurn:0.8,
  reset:{glow:0.15,strikeCd:2,burstCd:3,summonCd:0,herd:-1},
  intro:{short:1.4,long:4.2,glowStart:0.2,glowEnd:0.75,lookEnd:0.5,roarAt:0.6,crossingStep:1/30,absentHeight:4},
  begin:{glow:1,summonDelay:1.5}, victoryGlow:0.25,
  points:{rewardZ:4,rewardY:0.2,respawnZ:26,respawnYaw:0},
  strike:{id:'sweep',clip:KING_ATTACK_TIMING.sweep,action:'sweep',reach:7.1,chaseNear:0.9*7.1,chaseTurn:1.4,turn:1.2,radius:7.1-0.38,cooldown:5,tell:[0.3,0.6,0.75,0.25,24],trauma:0.15,contactTrauma:0.45},
  burst:{clip:KING_ATTACK_TIMING.strike,action:'strike',after:1,turn:1.2,radius:4.4,tell:[0.4,0.5,0.7,0.3,26],trauma:0.3},
  rings:{gap:0.8,speed:10.5,trauma:0.4,strike:'roots'},
  summon:{clip:KING_ATTACK_TIMING.roar,action:'roar',count:2,limit:3,cooldown:20,turn:1},
  lanes:{stop:18,speed:2.4,turn:1.6,burstRange:14,after:1.2,tell:1.1,action:'brace',batch:3,rest:-1.5,chainRest:0.4,soundTicks:1.5,trauma:0.6},
  adds:{kinds:['elk','boar'],radius:27,far:8,near:4.5,fast:4.8,slow:0.8,turn:2.5,chargeRange:11,rate:0.9,tell:0.7,trauma:0.3,leashPad:1},
  hazards:{count:3,angleStart:1,angleStep:2.1,angleOffset:0.35,radius:10,radiusStep:2.5,fallSeconds:0.75,every:0.8,damage:9,strike:'lantern',fromPhase:1},
  sounds:{intro:'king_bells',roar:'king_roar',burst:'king_stomp',add:'thrall_call',charge:'thrall_groan'},
} as const satisfies RoamingBossRow<'elk'|'boar','roar'|'sweep'|'strike'|'brace','king_bells'|'king_roar'|'king_stomp'|'thrall_call'|'thrall_groan'>;
