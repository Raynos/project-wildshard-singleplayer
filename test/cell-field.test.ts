import { beforeAll,expect,test } from 'vitest';
import { parse } from 'valibot';
import { CellFieldSchema,type CellFieldRows } from '../src/format/cellField';
import { CellField } from '../src/game/systems/cellField';
import { OriginalArenaField } from './fixtures/original-cell-field';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import { Scope } from '../src/engine/app/scope';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import { applyV2WorldActions } from '../src/game/shardfile/worldActionsV2';
import { TITAN_FIRE_FIELD } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import program from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };

const irrigation: CellFieldRows = { x: 10,z: 20,width: 3,depth: 1,cell: 2,
  observations: { duration: .35 },states: { idle: 4,active: 7,spent: 9 },
  channels: { state: 'phase',lifetime: 'ttl',clock: 'elapsed',pulse: 'advance',neighbours: 'links' },
  signals: { activate: 'fill',step: 'tick',clock: 'pulse' },neighbours: [[1,0]],
};
let water: ReturnProgram;
beforeAll(async () => {
  const alias = (names: readonly string[]): Record<string,string> => Object.fromEntries(names.map(name => [name,name]));
  const script = parseDecisionScripts([{ id: 'irrigation',abi: '1.0',side: 'sim',module: `blobs/wasm/${'0'.repeat(64)}.wasm`,source: 'behaviour/irrigation.as',binding: { shard: true },pages: 1,onFail: 'hold',on: ['signal'],tick: null,stateVersion: 1,state: [],params: {},reads: ['field'],commands: ['channel'],
    fields: alias(['phase','ttl','elapsed','advance','count','duration','dt']),channels: alias(['ttl','elapsed','advance','links']),signals: alias(['fill','tick','pulse']) }])[0];
  if (script === undefined) throw new Error('Missing cell fixture script');
  const source = `import { Signal,Field,Channel,Read,Do } from './generated/irrigation';
export function onSignal(signal:i32,value:f64,source:i32):void {
 if(signal==Signal.fill){Do.channel(Channel.ttl,Read.field(0,Field.phase)==4?Read.field(0,Field.duration):0);}
 else if(signal==Signal.pulse){Do.channel(Channel.elapsed,Read.field(0,Field.elapsed)+Read.field(0,Field.dt));Do.channel(Channel.advance,1);}
 else if(signal==Signal.tick){
  Do.channel(Channel.ttl,Read.field(0,Field.ttl)-Read.field(0,Field.dt));let links:i32=0;
  for(let i=1;i<=i32(Read.field(0,Field.count));i++)if(Read.field(i,Field.phase)==4)links|=1<<(i-1);
  Do.channel(Channel.links,Read.field(0,Field.advance)>0?links:0);
 }
}`;
  const registry = (rows: Readonly<Record<string,string>>): Map<string,number> => new Map(Object.values(rows).sort().map((name,index) => [name,index+1]));
  const built = await compileDecisionScripts([script],{ fields: registry(script.fields),channels: registry(script.channels),signals: registry(script.signals) },new Map([[script.source,source]]),{ asLineCeiling: 128,singleSignal: true });
  const row = built.rows[0], blob = built.blobs[0];if (row === undefined || blob === undefined) throw new Error('Missing cell fixture bytes');
  water = ReturnProgram.page({ script: row,bytes: btoa(Array.from(blob.bytes,value => String.fromCodePoint(value)).join('')) });
});

test('unrelated compiled irrigation law uses its own state codes/channels and delayed generations', () => {
  const field = new CellField(irrigation,water,new Rng(1));
  expect(Array.from({ length: field.length },(_,cell) => field.state(cell))).toEqual([4,4,4]);
  field.activate(11,21);expect(field.state(0)).toBe(7);expect(field.remaining(0)).toBeCloseTo(.35,6);
  field.update(.04,{});expect(field.state(1)).toBe(4);
  field.update(.06,{});expect(field.state(1)).toBe(7);expect(field.state(2)).toBe(4);
  field.update(.1,{});expect(field.state(2)).toBe(7);
  expect(field.update(.4,{})).toEqual([0,1,2]);expect(field.deactivate()).toEqual([]);expect(field.state(0)).toBe(9);
  field.clear();expect(field.state(0)).toBe(4);field.activate(11,21);expect(field.activeAt(11,21)).toBe(true);
});

test('original real Titan guest preserves field state, changed order, contact results and RNG exactly', () => {
  const rows = parse(CellFieldSchema,TITAN_FIRE_FIELD), actualRandom = new Rng(681), originalRandom = new Rng(681);
  const field = new CellField(rows,ReturnProgram.page(program.fire),actualRandom);
  const old = new OriginalArenaField({ ...rows,signals: { ignite: rows.signals.activate,step: rows.signals.step,clock: rows.signals.clock } },ReturnProgram.page(program.fire),originalRandom);
  let sample = 91;
  for (let tick = 0; tick < 160; tick++) {
    sample = (Math.imul(sample,1664525)+1013904223) >>> 0;
    const cell = sample%field.length, x = field.x(cell), z = field.z(cell), dt = [.04,.06,.1,.3][tick%4] ?? .1;
    if (tick%2 === 0) { field.activate(x,z);old.ignite(x,z); }
    if (tick%53 === 0) expect(field.deactivate()).toEqual(old.extinguish());
    if (tick%37 === 0) { field.clear();old.clear(); }
    const observations = { wx: Math.sin(tick),wz: Math.cos(tick) };
    expect(field.update(dt,observations)).toEqual(old.update(dt,observations));
    expect(field.sense(dt,{ x,z },{ mounted: tick%2 })).toEqual(old.sense(dt,{ x,z },{ mounted: tick%2 }));
    for (let index = -1; index <= field.length; index++) {
      expect(field.state(index)).toBe(old.mode(index));expect(Object.is(field.remaining(index),old.remaining(index))).toBe(true);
    }
    expect(actualRandom.snapshot()).toEqual(originalRandom.snapshot());
  }
});

test('JSON and binding admission refuses executable/accessor/ambiguous rows before guest work', () => {
  const random = new Rng(7), before = random.snapshot();let gets = 0;
  const accessor = { ...irrigation };Object.defineProperty(accessor,'channels',{ enumerable: true,get: () => { gets++;return irrigation.channels; } });
  const bad = [accessor,{ ...irrigation,extra: 1 },{ ...irrigation,width: 65 },{ ...irrigation,cell: 0 },
    { ...irrigation,states: { ...irrigation.states,active: 4 } },
    { ...irrigation,states: { ...irrigation.states,idle: 256 } },
    { ...irrigation,channels: { ...irrigation.channels,lifetime: 'phase' } },
    { ...irrigation,channels: { ...irrigation.channels,state: 'x' } },
    { ...irrigation,channels: { ...irrigation.channels,state: 'constructor' } },
    { ...irrigation,channels: { ...irrigation.channels,lifetime: 'toString' } },
    { ...irrigation,signals: { ...irrigation.signals,activate: () => 1 } },
    { ...irrigation,neighbours: Array.from({ length: 9 },() => [1,0]) },
    { ...irrigation,observations: { duration: Infinity } },
  ];
  for (const rows of bad) expect(() => new CellField(rows,water,random)).toThrow();
  expect(gets).toBe(0);expect(random.snapshot()).toEqual(before);
  expect(formatJsonSchema(CellFieldSchema, 'draft-07')).toMatchObject({ type: 'object',additionalProperties: false });
});

test('admitted rows are detached/frozen and invalid coordinates cannot activate a cell', () => {
  const rows = { ...irrigation,states: { ...irrigation.states },observations: { duration: .35 },neighbours: [[1,0]] };
  const field = new CellField(rows,water,new Rng(3));rows.states.active = 99;rows.observations.duration = 80;rows.neighbours.length = 0;
  expect(field.rows.states.active).toBe(7);expect(Object.isFrozen(field.rows.channels)).toBe(true);
  for (const [x,z] of [[Number.NaN,21],[11,Infinity],[9,20],[16,20],[10,22]] as const) field.activate(x,z);
  expect(Array.from({ length: field.length },(_,cell) => field.state(cell))).toEqual([4,4,4]);
  field.activate(11,21);expect(field.remaining(0)).toBeCloseTo(.35,6);field.update(.1,{});expect(field.state(1)).toBe(7);
});

test('H4 ignite lends the SAME concrete cell owner without another field or clock', () => {
  const scope = new Scope('cell command'), field = new CellField(irrigation,water,new Rng(3));
  const loan = { binding: 'orchard',target: 'cells',scope,kind: 'cell-field' as const,owner: field };
  applyV2WorldActions([{ binding: 'orchard',target: 'cells',kind: 'ignite',x: 11,z: 21 }],[loan]);
  expect(field.state(0)).toBe(7);expect(field.state(1)).toBe(4);scope.dispose();
  expect(() => applyV2WorldActions([{ binding: 'orchard',target: 'cells',kind: 'ignite',x: 13,z: 21 }],[loan])).toThrow('Retired');expect(field.state(1)).toBe(4);
});
