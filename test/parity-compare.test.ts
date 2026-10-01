import baselineFixture from './fixtures/parity/baseline.json';
import { describe, expect, it } from 'vitest';
import { compare, validateQuarantine } from '../scripts/parity/compare.mjs';
import type { RecordValue } from '../scripts/parity/value.mjs';

const fixture: RecordValue = baselineFixture;
const clone = (): RecordValue => structuredClone(fixture);
const rows = (b: RecordValue, n: RecordValue, options: Parameters<typeof compare>[2] = {}) => compare(b,n,options);
describe('parity comparison', () => {
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
    expect(rows({},n).rows).toContainEqual(expect.objectContaining({field:'boot.scene.totals.batched',verdict:'red'}));
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
});
