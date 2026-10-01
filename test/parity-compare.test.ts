import baselineFixture from './fixtures/parity/baseline.json';
import { describe, expect, it } from 'vitest';
import { compare, validateQuarantine } from '../scripts/parity/compare.mjs';
import { object, type RecordValue } from '../scripts/parity/value.mjs';

const fixture: RecordValue = baselineFixture;
const clone = (): RecordValue => structuredClone(fixture);
const rows = (b: RecordValue, n: RecordValue, options: Parameters<typeof compare>[2] = {}) => compare(b,n,options);
describe('parity comparison', () => {
  it('reports disposal messages as non-quarantinable failures even when the census is zero', () => {
    const n = clone();
    n['leak'] = { before: { bodies: 0 }, after: { bodies: 0 }, disposalErrors: ['body already removed'],
      weather: { before: { bodies: 0 }, after: { bodies: 0 }, disposalErrors: ['weather sound stopped'] } };
    const result = rows(fixture, n, { lanePending: true });
    for (const [field, message] of [['leak.disposalErrors', 'body already removed'], ['leak.weather.disposalErrors', 'weather sound stopped']]) {
      expect(result.rows).toContainEqual(expect.objectContaining({ field, now: [message], class: 'D', verdict: 'red' }));
    }
    n['leak'] = { before: { bodies: 0 }, after: { bodies: 0 }, disposalErrors: [] };
    expect(rows(fixture, n).rows.find((row) => row.field === 'leak.disposalErrors')?.verdict).toBe('green');
  });
  it('keeps exact structural order and ignores object property order', () => {
    const n = clone();
    expect(rows(fixture,n).verdict).toBe('green');
    n['boot'] = {...n['boot'] as RecordValue, systems:{update:['animals','physics.movers']}};
    expect(rows(fixture,n).rows).toContainEqual(expect.objectContaining({field:'boot.systems.update', verdict:'red'}));
  });
  it('measures noise bands and stays exact when recording spread is zero', () => {
    const n = clone(); n['poses'] = [{name:'gate', calls:108, tris:10300, pos:[0.2,1,0], ssim:0.975}];
    expect(rows(fixture,n).verdict).toBe('green');
    n['poses'] = [{name:'gate', calls:109, tris:10300, pos:[0.2,1,0], ssim:0.974}];
    expect(rows(fixture,n).rows.filter((r) => r.verdict === 'red').map((r) => r.field)).toEqual(['poses.gate.calls','poses.gate.ssim']);
    n['boot'] = {...n['boot'] as RecordValue, render:{programs:13}};
    expect(rows(fixture,n).rows).toContainEqual(expect.objectContaining({field:'boot.render.programs',band:'± 0',verdict:'red'}));
  });
  it('applies system and prefixed save renames without hiding reorder', () => {
    const n = clone(); n['boot'] = {...n['boot'] as RecordValue, systems:{update:['physics.mover','animals']}, saves:{read:['local:ws.purse.v2'],written:[]}};
    expect(rows(fixture,n,{renames:[{systems:{'physics.movers':'physics.mover'},saves:{'ws.purse.v1':'ws.purse.v2'}}]}).verdict).toBe('green');
  });
  it('replays registry additions without duplicating or replacing recorded pieces', () => {
    const piece = { id: 'npc-ranger', shapes: { cuboid: 1 } };
    const b = clone(); b['boot'] = { ...object(b['boot']), registry: [piece] };
    const n = clone(); n['boot'] = { ...object(n['boot']), registry: [piece] };
    const map = { registry: { added: ['npc-*'] } };
    expect(rows(b, n, { renames: [map, map] }).rows.find((row) => row.field === 'boot.registry')?.verdict).toBe('green');
    n['boot'] = { ...object(n['boot']), registry: [{ ...piece, shapes: { cuboid: 2 } }] };
    expect(rows(b, n, { renames: [map] }).rows.find((row) => row.field === 'boot.registry')?.verdict).toBe('red');
    n['boot'] = { ...object(n['boot']), registry: [piece, piece] };
    expect(rows(b, n, { renames: [map] }).rows.find((row) => row.field === 'boot.registry')?.verdict).toBe('red');
    b['boot'] = { ...object(b['boot']), registry: [] };
    n['boot'] = { ...object(n['boot']), registry: [piece] };
    expect(rows(b, n, { renames: [map, map] }).rows.find((row) => row.field === 'boot.registry')?.verdict).toBe('green');
    n['boot'] = { ...object(n['boot']), registry: [piece, piece] };
    expect(rows(b, n, { renames: [map] }).rows.find((row) => row.field === 'boot.registry')?.verdict).toBe('red');
  });
  it('applies phase-specific system renames before the flat map (F8)', () => {
    const b=clone(); b['boot']={...b['boot'] as RecordValue,systems:{'fixed.pre':['physics.bodies'],'fixed.post':['physics.bodies'],update:['physics.bodies']}};
    const n=clone(); n['boot']={...n['boot'] as RecordValue,systems:{'fixed.pre':['physics.bodies.pre'],'fixed.post':['physics.bodies.post'],update:['bodies']}};
    expect(rows(b,n,{renames:[{systems:{'physics.bodies':'bodies'},phaseSystems:{'fixed.pre':{'physics.bodies':'physics.bodies.pre'},'fixed.post':{'physics.bodies':'physics.bodies.post'}}}]}).verdict).toBe('green');
  });
  it('keeps dotted phase keys flat when it renames (no phantom boot.systems.fixed row)', () => {
    const b=clone(); b['boot']={...b['boot'] as RecordValue,systems:{'fixed.pre':['physics.bodies'],update:['x']}};
    const n=clone(); n['boot']={...n['boot'] as RecordValue,systems:{'fixed.pre':['physics.bodies.pre'],update:['x']}};
    const out=rows(b,n,{renames:[{phaseSystems:{'fixed.pre':{'physics.bodies':'physics.bodies.pre'}}}]});
    expect(out.verdict).toBe('green');
    expect(out.rows.some((r)=>r.field==='boot.systems.fixed')).toBe(false);
  });
  it('uses shard-specific anonymous system renames before phase and flat maps (F8)',()=>{
    const b=clone();b['boot']={...b['boot'] as RecordValue,systems:{update:['update#1']}};
    const n=clone();n['boot']={...n['boot'] as RecordValue,systems:{update:['pine.life']}};
    const map={systems:{'update#1':'generic'},phaseSystems:{update:{'update#1':'phase'}},shardSystems:{'pine-hollow':{update:{'update#1':'pine.life'}}}};
    expect(rows(b,n,{renames:[map]}).verdict).toBe('green');
    n['boot']={...object(n['boot']),systems:{update:['phase']}};
    expect(rows(b,n,{renames:[map]}).rows.find((r)=>r.field==='boot.systems.update')?.verdict).toBe('red');
  });
  it('compares event counts and requires each baseline ambient id, allowing extras', () => {
    const n = clone(); n['walk'] = {...n['walk'] as RecordValue,sounds:{event:{step:5},ambient:['new','forest.thrall']}};
    expect(rows(fixture,n).verdict).toBe('green');
    n['walk'] = {...n['walk'],sounds:{event:{step:6},ambient:[]}};
    expect(rows(fixture,n).rows.filter((r) => r.verdict === 'red').map((r) => r.field)).toEqual(['walk.sounds.event','walk.sounds.ambient']);
    expect(rows(fixture,n,{ambientInfo:['forest.thrall']}).rows.find((r)=>r.field === 'walk.sounds.ambient')?.verdict).toBe('green');
  });
  it('checks filled pending values on m5 and leaves runner pending', () => {
    const n=clone(); n['poses']=[{name:'gate',calls:200,tris:10000,pos:[0,1,0],ssim:1}];
    const pending: RecordValue[]=[{id:'P1',shard:'pine-hollow',fields:['poses.gate.calls'],expect:null}];
    expect(rows(fixture,n,{pending}).verdict).toBe('pending');
    pending[0] = {...pending[0],expect: {'phone/poses.gate.calls':190}};
    expect(rows(fixture,n,{pending}).verdict).toBe('red');
    n['boot']={...n['boot'] as RecordValue,lane:'gh-macos15'};
    const b=clone(); b['boot']={...b['boot'] as RecordValue,lane:'gh-macos15'};
    expect(rows(b,n,{pending}).verdict).toBe('pending');
  });
  it('never exempts thresholds for recording, pending or lane-pending', () => {
    const n=clone(); n['walk']={...n['walk'] as RecordValue,stuck:1};
    expect(rows({},n,{lanePending:true,pending:[{shard:'pine-hollow',fields:['walk.stuck'],expect:null}]}).verdict).toBe('red');
    n['boot']={...n['boot'] as RecordValue,scene:{totals:{mesh:100,batched:1}}};
    expect(rows(fixture,n,{lanePending:true}).rows).toContainEqual(expect.objectContaining({field:'boot.scene.totals.batched',verdict:'red'}));
  });
  it('ratchets existing non-facade batches but keeps Nine Dragon at zero (B15)', () => {
    const b=clone(); b['boot']={...b['boot'] as RecordValue,scene:{totals:{batched:2}}};
    const n=structuredClone(b);
    expect(rows(b,n).rows.find((r)=>r.field==='boot.scene.totals.batched')?.verdict).toBe('green');
    n['boot']={...object(n['boot']),scene:{totals:{batched:1}}};
    expect(rows(b,n).rows.find((r)=>r.field==='boot.scene.totals.batched')?.verdict).toBe('green');
    n['boot']={...object(n['boot']),scene:{totals:{batched:3}}};
    expect(rows(b,n).rows.find((r)=>r.field==='boot.scene.totals.batched')?.verdict).toBe('red');
    n['boot']={...object(n['boot']),shard:'nine-dragon-stack',scene:{totals:{batched:2}}};
    expect(rows(b,n).rows.find((r)=>r.field==='boot.scene.totals.batched')?.verdict).toBe('red');
  });
  it('fails equal stuck and out counts when both violate their absolute rules', () => {
    const n=clone(); n['walk']={stuck:1,legs:[{name:'escape',stuck:[],out:838}]};
    const red=rows(n,n).rows.filter((r)=>r.verdict==='red').map((r)=>r.field);
    expect(red).toContain('walk.stuck');
    expect(red).toContain('walk.legs.escape.out');
  });
  it('marks genuinely new fields, but detects removed baseline fields', () => {
    const n=clone(); n['extra']='new'; expect(rows(fixture,n).rows.find((r)=>r.field==='extra')?.verdict).toBe('new');
    delete n['walk']; expect(rows(fixture,n).verdict).toBe('red');
  });
  it('quarantines only valid, unexpired structural or measured fields for at most 3 days', () => {
    const q={id:'pine-hollow/phone/poses.gate.calls',owner:'lead',ask:'E357',since:'2026-09-30',until:'2026-10-03',why:'fix pending'};
    expect(validateQuarantine([q],'2026-09-30')).toEqual([]);
    expect(validateQuarantine([{...q,until:'2026-10-04'}],'2026-09-30').length).toBeGreaterThan(0);
    expect(validateQuarantine([{...q,id:'pine-hollow/phone/walk.stuck'}],'2026-09-30').length).toBeGreaterThan(0);
    const n=clone(); n['poses']=[{name:'gate',calls:900,tris:10000,pos:[0,1,0],ssim:1}];
    expect(rows(fixture,n,{quarantine:[q],now:'2026-09-30'}).verdict).toBe('green');
    expect(rows(fixture,n,{quarantine:[q],now:'2026-10-04'}).verdict).toBe('red');
  });
  it('keeps vector bands independent per axis and compares filled vectors to expected values',()=>{
    const b=clone();b['spread']={...b['spread'] as RecordValue,'poses.gate.pos':[0.1,0,0.2]};
    const n=clone();n['poses']=[{name:'gate',calls:100,tris:10000,pos:[0.2,1.01,0.4],ssim:1}];
    expect(rows(b,n).rows.find((r)=>r.field==='poses.gate.pos')?.verdict).toBe('red');
    n['poses']=[{name:'gate',calls:100,tris:10000,pos:[10.2,1,0.4],ssim:1}];
    expect(rows(b,n,{pending:[{id:'P2',shard:'pine-hollow',fields:['poses.gate.pos'],expect:{'phone/poses.gate.pos':[10,1,0]}}]}).verdict).toBe('pending');
  });
  it('fails on an added event sound and survives a changed informational time',()=>{
    const n=clone();n['walk']={...n['walk'] as RecordValue,sounds:{event:{step:5,extra:1},ambient:['forest.thrall']}};
    expect(rows(fixture,n).rows.find((r)=>r.field==='walk.sounds.event')?.verdict).toBe('red');
    const clean=clone();clean['boot']={...clean['boot'] as RecordValue,playMs:90000};
    expect(rows(fixture,clean).verdict).toBe('green');
  });
  it('uses the recorded image band around a filled pending image value',()=>{
    const n=clone();n['poses']=[{name:'gate',calls:100,tris:10000,pos:[0,1,0],ssim:0.885}];
    const pending: RecordValue[]=[{id:'P3',shard:'pine-hollow',fields:['poses.gate.ssim'],expect:{'phone/poses.gate.ssim':0.9}}];
    expect(rows(fixture,n,{pending}).verdict).toBe('pending');
    n['poses']=[{name:'gate',calls:100,tris:10000,pos:[0,1,0],ssim:0.86}];
    expect(rows(fixture,n,{pending}).verdict).toBe('red');
  });
  it('does not confuse the shard id with the informational SHA field',()=>{
    const n=clone();n['boot']={...n['boot'] as RecordValue,shard:'nalati-grasslands'};
    expect(rows(fixture,n).rows.find((r)=>r.field==='boot.shard')?.verdict).toBe('red');
  });
  it('holds kill limits, pause state, leak census and budgets without a baseline',()=>{
    const n=clone();n['combat']={shot:{hits:1,hitWithinS:1,hitLimit:20,killed:false,killWithinS:null,killLimit:20}};
    n['pauseResume']={diff:['player.vel'],appStates:['paused','play']};
    n['leak']={before:{geometries:1},after:{geometries:2}};
    n['budgets']={gate:{derived:{draws:99},ceiling:null}};
    expect(rows({},n).rows.filter((r)=>r.verdict==='red').map((r)=>r.field)).toEqual(['combat.shot','pauseResume','leak.geometries','budgets.gate.draws']);
  });
  it('enforces weather unload counts and prints actual B0/B1 values',()=>{
    const n=clone();n['leak']={before:{geometries:1},after:{geometries:1},weather:{before:{listeners:{window:2}},after:{listeners:{window:3}}}};
    expect(rows({},n).rows).toContainEqual(expect.objectContaining({field:'leak.weather.listeners.window',baseline:2,now:3,class:'D',verdict:'red'}));
  });
});
