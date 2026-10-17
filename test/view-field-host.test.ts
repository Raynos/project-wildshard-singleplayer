import { expect, test } from 'vitest';
import { ViewFieldHost } from '../src/engine/script/viewFields';
import { DecisionHost, type DecisionScript } from '../src/engine/script/decision';
import { compileScript } from '@wildshard/sdk/compileScript';
import { scriptV1Layout } from '../src/format/scriptAbiV1';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '@wildshard/sdk/decisionScriptBindings';

const row: DecisionScript = { id: 'dusk', module: 'fixture', side: 'view', on: ['start'], tick: null, onFail: 'hold', stateVersion: 1,
  state: [], params: {}, ids: { fields: { dusk: 310 } }, reads: [], lists: [], commands: ['view.field'] };
function module(value: number, op = 105, badTail = false): Promise<Uint8Array> {
  const out = 16384 + scriptV1Layout(0, 0).outbox * 8;
  const tail = badTail ? `store<f64>(${out + 40},105);store<f64>(${out + 48},0);store<f64>(${out + 56},310);store<f64>(${out + 64},2);store<f64>(${out + 72},0);` : '';
  return compileScript(`export function ws_abi():i32{return 1;} export function ws_init(lo:i32,hi:i32):void{} export function ws_io():i32{return 16384;}
export function ws_handle():i32{store<f64>(${out},${op});store<f64>(${out + 8},0);store<f64>(${out + 16},310);store<f64>(${out + 24},${value});store<f64>(${out + 32},0);${tail}return ${badTail ? 2 : 1};}`, { abi: 1 });
}
async function setup(value: number, op = 105, badTail = false) {
  const modules = new Map([['fixture', await module(value, op, badTail)]]);
  const options = { fields: [{ id: 310, name: 'shared.dusk', type: 'f64' as const, privacy: 'host' as const, default: 0, min: 0, max: 1 }],
    scripts: [row], bindings: [{ id: 1, script: 'dusk', self: 0, actors: [], instance: 0 }], modules, seed: [7, 0] as const };
  return { options, view: new ViewFieldHost(options) };
}
test('real client Wasm writes only an isolated host-private field, atomically on the next step', async () => {
  const f = await setup(0.6); f.view.enqueue(1, [1, 0, 0, 0, 0, 0]);
  for (let tick = 1; tick <= 6; tick++) f.view.step(tick);
  expect(f.view.value('shared.dusk')).toBe(0); f.view.step(7); expect(f.view.value('shared.dusk')).toBe(0.6);
  expect(f.view.value('player.health')).toBeUndefined();
  expect(() => new DecisionHost({ ...f.options, scripts: [{ ...row, side: 'sim' }], world: { read: () => 0, list: () => 0, prepare: () => ({ commit: () => undefined }), failed: () => undefined } })).toThrow('capability');
});
test('bounds and authoritative commands roll back the whole visual transaction', async () => {
  for (const [value, op] of [[2, 105], [0.5, 4]] as const) {
    const f = await setup(value, op); f.view.enqueue(1, [1, 0, 0, 0, 0, 0]);
    for (let tick = 1; tick <= 7; tick++) f.view.step(tick);
    expect(f.view.value('shared.dusk')).toBe(0); expect(f.view.host.metrics()[0]?.refusals).toBe(1);
  }
  const f = await setup(0.5);
  expect(() => new ViewFieldHost({ ...f.options, fields: [{ ...f.options.fields[0], id: 311, name: 'wrong', type: 'f64', privacy: 'host', default: 0 }] })).toThrow('host-private');
});

test('an invalid final field write discards earlier valid writes in the same Wasm call', async () => {
  const f = await setup(0.5, 105, true); f.view.enqueue(1, [1, 0, 0, 0, 0, 0]);
  for (let tick = 1; tick <= 7; tick++) f.view.step(tick);
  expect(f.view.value('shared.dusk')).toBe(0); expect(f.view.host.metrics()[0]?.refusals).toBe(1);
});

test('authored AssemblyScript uses the generated view.field capability through the real compiler', async () => {
  const input = { id: 'fixture.view', abi: '1.0', side: 'view', module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
    source: 'behaviour/view.as', binding: { shard: true }, on: ['start'], onFail: 'hold', reads: [], commands: ['view.field'],
    fields: { dusk: 'client.dusk' }, stateVersion: 1, state: [], params: {} };
  const registries = { fields: new Map([['client.dusk', 310]]) };
  const built = await compileDecisionScripts([input], registries, new Map([['behaviour/view.as',
    "import {Do,Field} from './generated/fixtureView'; export function onStart():void { Do.viewField(Field.dusk,0.75); }"]]), { asLineCeiling: 1 });
  const compiled = built.rows[0], blob = built.blobs[0];
  if (compiled === undefined || blob === undefined) throw new Error('Missing view compilation');
  const ids = generateDecisionBindings(compiled, registries).map.ids;
  const view = new ViewFieldHost({ fields: [{ id: 310, name: 'client.dusk', type: 'f64', privacy: 'host', default: 0, min: 0, max: 1 }],
    scripts: [{ ...compiled, ids, reads: [], lists: [] }], bindings: [{ id: 1, script: compiled.id, self: 0, actors: [], instance: 0 }],
    modules: new Map([[compiled.module, blob.bytes]]), seed: [7, 0] });
  view.enqueue(1, [1, 0, 0, 0, 0, 0]);
  for (let tick = 1; tick <= 7; tick++) view.step(tick);
  expect(view.value('client.dusk')).toBe(0.75); expect(view.host.metrics()[0]?.refusals).toBe(0);
});
