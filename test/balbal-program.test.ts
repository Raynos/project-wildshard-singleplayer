import { afterEach,expect,test,vi } from 'vitest';
import { parse } from 'valibot';
import { CreatureGuestSchema } from '../src/format/speciesBookRows';
import { program } from '../src/shards/nalati-grasslands/species/balbal';
import * as strikes from '../src/engine/ai/strikeRows';
import { ReturnProgram } from '../src/game/population/returnProgram';
import generated from '../src/shards/nalati-grasslands/data/species.generated.json' with {type:'json'};

afterEach(()=>{vi.restoreAllMocks();});

test('a strike refusal cannot publish a program or start a later encounter',()=>{
  const strikeRead=vi.spyOn(strikes,'strikeFromData').mockImplementation(()=>{throw new Error('Native strike refused');});
  const programRead=vi.spyOn(ReturnProgram,'page'),encounter=vi.fn();
  expect(()=>{encounter(program());}).toThrow('Native strike refused');
  expect(strikeRead).toHaveBeenCalledOnce();
  expect(programRead).not.toHaveBeenCalled();expect(encounter).not.toHaveBeenCalled();
});

test('native strike binding precedes program allocation and is reused',()=>{
  const strikeRead=vi.spyOn(strikes,'strikeFromData'),programRead=vi.spyOn(ReturnProgram,'page');
  program();program();
  expect(strikeRead).toHaveBeenCalledExactlyOnceWith(generated.presentation.guest.strike);
  expect(programRead).toHaveBeenCalledTimes(2);
  expect(strikeRead.mock.invocationCallOrder[0]).toBeLessThan(programRead.mock.invocationCallOrder[0]??0);
});

test('the defining admission refuses malformed native strike rows',()=>{
  const guest=generated.presentation.guest;
  for(const shape of [{kind:'wedge',length:-1,halfAngle:.96},{kind:'wedge',length:3.5,halfAngle:Number.NaN},{kind:'unknown'}]) {
    expect(()=>parse(CreatureGuestSchema,{...guest,strike:{...guest.strike,shape}})).toThrow();
  }
});
