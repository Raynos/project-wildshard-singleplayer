// oxlint-disable-next-line import/no-nodejs-modules -- validate generated guest rows without inferring the complete JSON type
import { readFileSync } from 'node:fs';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { lendNalatiHeld } from './fixtures/nalati-return-modules';
import { object, parse } from 'valibot';
import { CreatureGuestSchema } from '../src/format/speciesBookRows';
import { program } from './fixtures/projectedCreature';
import * as strikes from '../src/engine/ai/strikeRows';
import { ReturnProgram } from '../src/game/population/returnProgram';

const generated=parse(object({presentation:object({guest:CreatureGuestSchema})}),JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json','utf8')));

let scope:Scope;
beforeEach(()=>{scope=new Scope('balbal-program');scope.expose(app,'levelScope',scope);lendNalatiHeld(scope);});
afterEach(()=>{vi.restoreAllMocks();scope.dispose();});

test('a strike refusal cannot publish a program or start a later encounter',()=>{
  const strikeRead=vi.spyOn(strikes,'strikeFromData').mockImplementation(()=>{throw new Error('Native strike refused');});
  const programRead=vi.spyOn(ReturnProgram,'page'),encounter=vi.fn();
  expect(()=>{encounter(program());}).toThrow('Native strike refused');
  expect(strikeRead).toHaveBeenCalledOnce();
  expect(programRead).not.toHaveBeenCalled();expect(encounter).not.toHaveBeenCalled();
});

test('native strike binding precedes program allocation and is reused',()=>{
  const strikeRead=vi.spyOn(strikes,'strikeFromData'),programRead=vi.spyOn(ReturnProgram,'page');
  const first=program();expect(program()).toBe(first);
  expect(strikeRead).toHaveBeenCalledExactlyOnceWith(generated.presentation.guest.strike);
  expect(programRead).toHaveBeenCalledOnce();
  expect(strikeRead.mock.invocationCallOrder[0]).toBeLessThan(programRead.mock.invocationCallOrder[0]??0);
});

test('the defining admission refuses malformed native strike rows',()=>{
  const guest=generated.presentation.guest;
  for(const shape of [{kind:'wedge',length:-1,halfAngle:.96},{kind:'wedge',length:3.5,halfAngle:Number.NaN},{kind:'unknown'}]) {
    expect(()=>parse(CreatureGuestSchema,{...guest,strike:{...guest.strike,shape}})).toThrow();
  }
});
