// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { parseHeldMeleePhase } from '../src/format/clientChannels';
import { createHeldMeleeBinding } from '../src/game/plugin/ui';
import { FAN_PHASE } from '../src/shards/far-reach/data/meleePhase';
import { WHIP_PHASE } from '../src/shards/sunscar-dunes/data/meleePhase';

it('admits both shipping modes and refuses crossed phase identities, intervals and action names', () => {
 expect(parseHeldMeleePhase(FAN_PHASE)).toEqual(FAN_PHASE);
 expect(parseHeldMeleePhase(WHIP_PHASE)).toEqual(WHIP_PHASE);
 expect(()=>parseHeldMeleePhase({...FAN_PHASE,secondary:{...FAN_PHASE.secondary,phase:FAN_PHASE.phases[0]}})).toThrow();
 expect(()=>parseHeldMeleePhase({...FAN_PHASE,secondary:{...FAN_PHASE.secondary,action:'attack'}})).toThrow();
 expect(()=>parseHeldMeleePhase({...WHIP_PHASE,show:WHIP_PHASE.unroll})).toThrow();
 expect(()=>parseHeldMeleePhase({...WHIP_PHASE,second:WHIP_PHASE.unroll})).toThrow();
 expect(()=>parseHeldMeleePhase({...WHIP_PHASE,overlap:WHIP_PHASE.second})).toThrow();
 expect(()=>parseHeldMeleePhase({...WHIP_PHASE,charge:Number.NaN})).toThrow();
 expect(()=>parseHeldMeleePhase({...WHIP_PHASE,bindings:{...WHIP_PHASE.bindings,resting:WHIP_PHASE.bindings.moving}})).toThrow();
 expect(()=>parseHeldMeleePhase({...FAN_PHASE,callback:()=>undefined})).toThrow();
});
it('binds only the actual owned delayed parts and compiles stable phase lookup without copying or changing poses', () => {
 const moving=new Group(),resting=new Mesh(),deformation=new Mesh();moving.position.set(-0,3,2);
 const parts=new Map<string,unknown>([['grip',moving],['coil',resting],['cord',deformation]]);
 const bound=createHeldMeleeBinding(WHIP_PHASE,parts);
 expect(bound.moving).toBe(moving);expect(bound.resting).toBe(resting);expect(bound.deformation).toBe(deformation);
 expect(Object.is(moving.position.x,-0)).toBe(true);expect(moving.position.y).toBe(3);
 expect(bound.phases.get('heavy')).toEqual(WHIP_PHASE.phases[1]);
 expect(()=>createHeldMeleeBinding(WHIP_PHASE,new Map([['grip',moving]]))).toThrow('owned scene part');
 expect(()=>createHeldMeleeBinding(WHIP_PHASE,new Map<string,unknown>([['grip',{}],['coil',resting],['cord',deformation]]))).toThrow('owned scene part');
 const immediate=createHeldMeleeBinding(FAN_PHASE,new Map());expect(immediate.phases.get('gust')).toEqual(FAN_PHASE.secondary.phase);expect(immediate.moving).toBeNull();
});
