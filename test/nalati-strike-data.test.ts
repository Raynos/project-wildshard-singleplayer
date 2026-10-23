import {expect,test} from 'vitest';
import {strike} from '@wildshard/sdk/species';
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {NALATI_STRIKE_ROWS as original} from './fixtures/originalNalatiStrikeRows';
import rows from '../src/shards/nalati-grasslands/data/strikeProfiles.json' with {type:'json'};

function admitted(input:Readonly<Record<string,unknown>>) {
  return Object.fromEntries(Object.entries(input).map(([name,row])=>[name,Array.isArray(row)?row.map(value=>strike(value)):strike(row)]));
}
test('strike data retains every original ordered key, exact f64 value and emitted row',()=>{
  expect(JSON.stringify(rows)).toBe(JSON.stringify(original));
  expect(encodeCanonicalJson(admitted(rows))).toBe(encodeCanonicalJson(admitted(original)));
  expect(Object.is(rows.balbal.windup,2.9*.55)).toBe(true);
  expect(Object.is(rows.balbal.recover,2.9*.45)).toBe(true);
  expect(Object.is(rows.bite.windup,.9*.7)).toBe(true);
  expect(Object.is(rows.bite.recover,.9*.3)).toBe(true);
});

test('native strike admission keeps strict shape and damage refusals',()=>{
  expect(()=>strike({...rows.balbal,damage:Infinity})).toThrow();
  expect(()=>strike({...rows.balbal,shape:{kind:'wedge',length:3.5,halfAngle:Infinity}})).toThrow();
  expect(()=>strike({...rows.bite,shape:{...rows.bite.shape,extra:1}})).toThrow();
  expect(()=>strike({...rows.balbal,windup:-1})).toThrow();
});
