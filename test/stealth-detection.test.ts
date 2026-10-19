import { expect, it } from 'vitest';
import { StealthDetection } from '../src/game/stealth/controller';
import rows from '../src/shards/nalati-grasslands/data/stealth.generated.json' with {type:'json'};

const observation={...rows.tuning,grass:1,forced:0,blocked:0,practice:0,crouched:1,px:0,pz:0,sprint:0,jump:0,toggle:0};
it('runs eligibility and detection only at 10 Hz',()=>{
 const law=new StealthDetection(rows.program);
 expect(law.step(.05,observation,[])).toBe(false);expect(law.state['can']).toBe(0);
 expect(law.step(.05,observation,[])).toBe(true);
 law.step(.1,observation,[]);law.step(.1,observation,[]);
 expect(law.state['can']).toBe(1);expect(law.state['state']).toBe(2);
 law.step(.1,{...observation,toggle:1},[]);expect(law.state['latched']).toBe(1);
 law.step(.1,{...observation,jump:1},[]);expect(law.state['latched']).toBe(0);
});
it('observes detection and direction from the existing animal senses',()=>{
 const law=new StealthDetection(rows.program),threats=[{x:10,z:5,awareness:.5,alert:.35,hunting:1}];
 law.step(.1,observation,threats);expect(law.state['state']).toBe(4);expect(law.state['threat']).toBe(1);expect(law.state['x']).toBe(10);
 law.step(.1,observation,[{...threats[0],x:1000,z:0,awareness:1,alert:.35,hunting:1}]);expect(law.state['state']).toBe(2);
});
it('lets an unrelated marsh fixture tune crouch cover and hysteresis entirely through rows',()=>{
 const law=new StealthDetection(rows.program),marsh={...observation,longGrass:.25,inAfter:.1,hiddenCover:.5,grass:.5,low:.65,high:1.8};
 law.step(.1,marsh,[]);expect(law.state['can']).toBe(1);expect(law.state['state']).toBe(2);
 law.step(.1,{...marsh,blocked:1},[]);expect(law.state['can']).toBe(0);expect(law.state['inLong']).toBe(0);
});

it('admits the full bounded threat snapshot',()=>{
 const law=new StealthDetection(rows.program),threats=Array.from({length:8},(_,i)=>({x:i+2,z:0,awareness:i===7?1:0,alert:.35,hunting:0}));
 law.step(.1,{...observation,sense:200},threats);expect(law.state['state']).toBe(4);expect(law.state['x']).toBe(9);
});
