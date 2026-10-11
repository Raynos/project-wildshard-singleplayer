import { expect, it } from 'vitest';
import { generateDirectorAbi } from '@wildshard/sdk/directorAbi';
import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';
import declaration from '../src/shards/pine-hollow/data/director.json';

it('reads declared fractional observations through the typed ABI without allocating author state', async () => {
  const source = `import { inputs } from "./wildshard-director";
    export function night(): f64 { return inputs.night; }`;
  const compiled = await compileBehaviourModule(source, 1, { 'wildshard-director.ts': generateDirectorAbi(declaration) });
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
  const observations = new DataView(memory.buffer);
  // Pine's fifth observation is a numeric night blend, even though its declared bounds are 0..1.
  observations.setFloat64(16384 + (6 + 4) * 8, 0.375, true);
  const { instance } = await WebAssembly.instantiate(Uint8Array.from(compiled.bytes).buffer, {
    env: { memory, enter: () => undefined, leave: () => undefined, fuel: () => undefined, finite32: Math.fround, finite64: (value: number) => value },
  });
  const night = instance.exports['night'];
  if (typeof night !== 'function') throw new Error('Missing native observation getter');
  expect((night as () => number)()).toBe(0.375);
});

it('refuses ambiguous, reserved and invalid AS aliases before compilation', () => {
  for (const keys of [['altar-lit', 'altar.lit'], ['class'], ['3bad'], ['__proto__']]) {
    expect(() => generateDirectorAbi({ ...declaration, inputs: keys.map(key => ({ key, min: 0, max: 1 })) })).toThrow();
  }
  expect(() => generateDirectorAbi({ ...declaration, inputs: [{ key: 'night', min: 2, max: 1 }] })).toThrow();
});

it('generates v2 boolean inputs in declared order with the same numeric host packing', async () => {
  const data = { version: 2, id: 'fixture.director', inputs: { altarLit: 'flag:fixture.altar', captainDead: 'actor:captain.dead' }, stages: [{ id: 'calm' }] };
  const compiled = await compileBehaviourModule(`import { inputs } from "./wildshard-director";
    export function summon(): bool { return inputs.altarLit && !inputs.captainDead; }`, 1,
  { 'wildshard-director.ts': generateDirectorAbi(data) });
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
  const observations = new DataView(memory.buffer);
  observations.setFloat64(16432, 1, true);
  const { instance } = await WebAssembly.instantiate(Uint8Array.from(compiled.bytes).buffer, {
    env: { memory, enter: () => undefined, leave: () => undefined, fuel: () => undefined, finite32: Math.fround, finite64: (value: number) => value },
  });
  const summon = instance.exports['summon'];
  if (typeof summon !== 'function') throw new Error('Missing native boolean getter');
  expect((summon as () => number)()).toBe(1);
  observations.setFloat64(16440, 1, true);
  expect((summon as () => number)()).toBe(0);
  expect(() => generateDirectorAbi({ ...data, inputs: { class: 'flag:fixture.altar' } })).toThrow('identifiers');
});
