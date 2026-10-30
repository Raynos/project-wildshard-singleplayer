import { afterEach, expect, test } from 'vitest';
import { bindFlatTerrain } from '@wildshard/engine/test/terrain';
import { Scope } from '../src/engine/app/scope';
import {onFault, type Fault} from '../src/engine/core/faults';
import { WeatherContinuation } from '../src/engine/world/weatherContinuation';
import { parseWeatherProgram, parseWeatherReactions } from '../src/format/weatherProgram';
import { App } from '../src/engine/app/app';
import { PlayerHealth } from '../src/engine/combat/health';
import { fakeWorld } from '@wildshard/engine/test/world';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import type { ShardContext } from '../src/game/plugin/context';
import { applyWeatherCover,bindPageWeatherHit,installWeatherReactions } from '../src/game/weather/reactions';
import pine from '../src/shards/pine-hollow/data/weather.json' with { type: 'json' };
import {weatherWitness as storm} from './fixtures/weatherInlineWitness';

// A made-up marsh shard (G474's fixture second user): a Pine-shaped rain program whose rain flashes in the cloud and whose
// open ground tells the player to keep low, on its own registers, cadence, points and shelters.
const program = parseWeatherProgram({ ...pine, registers: { ...pine.registers, ready: 0, armed: 0, wait: 0, flash: 0, bearing: 2, low: 0, lowFor: 0 },
  actions: { ...pine.actions, squall: [{ target: 'ready', value: 'state.rain' }] } });
const player = ['px', 'py', 'pz', 'crouched', 'mounted', 'sheltered'].map(name => [name, `input.${name}`]);
const marsh = { version: 1, hz: 5, script: storm.script, bytes: storm.bytes, actions: { event: 'squall' }, active: ['rain'], flash: 'flash',
  shelter: { margin: 1, circles: [[40, 40, 3]] }, points: [[5, 0, 9], [200, 200, 30]],
  steps: [
    { signal: 'tick', observe: [['dt', 'dt'], ['armed', 'register.armed'], ['pendingT', 'register.wait'], ['ready', 'register.ready'], ['storm', 'state.never'],
      ['gust', 'state.rain'], ['bearing', 'register.bearing'], ['flash', 'register.flash']], random: true,
      write: [['flash', 'register.flash']], emit: [{ event: 'flicker', when: 'distance', fields: [['far', 'output.distance'], ['towards', 'output.bearing']] }] },
    { signal: 'low', observe: [...player, ['dt', 'dt'], ['lowFor', 'register.lowFor'], ['gust', 'state.rain'], ['storm', 'state.never']],
      probe: { x: 'input.px', z: 'input.pz', radius: 30 }, write: [['low', 'register.low'], ['lowFor', 'register.lowFor']], emit: [] },
  ] };

let restore = (): void => undefined;
afterEach(() => { restore(); });
function install(rows: unknown = marsh): ReturnType<typeof installWeatherReactions> {
  restore = bindFlatTerrain({ heightAt: () => 0 });
  const air = new WeatherContinuation(program, { seed: 5, mode: 'live' });
  const reactions = installWeatherReactions(air, parseWeatherReactions(rows, program), { scope: new Scope('marsh') });
  Object.assign(reactions.inputs, { crouched: 0, mounted: 0 });
  return reactions;
}

test('a second shard drives its own rows at its own cadence and hears its own events', () => {
  const marshWeather = install();
  marshWeather.weather.force('rain', .2); marshWeather.weather.hold = true;
  const flickers: Record<string, number>[] = [];
  marshWeather.on('flicker', event => { flickers.push({ ...event }); });
  let ticks = 0;
  for (let i = 0; i < 60; i++) if (marshWeather.update(1 / 60)) ticks++;
  expect(ticks).toBe(5);
  expect(flickers).toHaveLength(5);
  for (const flicker of flickers) { expect(flicker['far']).toBeGreaterThanOrEqual(500); expect(flicker['far']).toBeLessThanOrEqual(1200); }
  expect(marshWeather.flash).toBe(.55); expect(marshWeather.stormActive).toBe(true);
});

test('probes, shelters and covered inputs decide what the steps observe', () => {
  const marshWeather = install();
  marshWeather.weather.force('rain', .2); marshWeather.weather.hold = true;
  Object.assign(marshWeather.inputs, { px: 0, py: 0, pz: 0 });
  marshWeather.update(.2); expect(marshWeather.register('low')).toBe(0); // the 9 m point stands over the player
  Object.assign(marshWeather.inputs, { px: -120, pz: -120 });
  marshWeather.update(.2); expect(marshWeather.register('low')).toBe(1); expect(marshWeather.register('lowFor')).toBeCloseTo(.2);
  Object.assign(marshWeather.inputs, { px: 40, pz: 41 });
  marshWeather.update(.2); expect(marshWeather.inputs['sheltered']).toBe(1); expect(marshWeather.register('low')).toBe(0);
  Object.assign(marshWeather.inputs, { px: -120, pz: -120, covered: 1 });
  marshWeather.update(.2); expect(marshWeather.register('low')).toBe(0);
});

test('the whole continuation snapshots as plain values and refuses foreign registers', () => {
  const marshWeather = install();
  marshWeather.weather.force('rain', .2);
  for (let i = 0; i < 7; i++) marshWeather.update(.07);
  const saved = marshWeather.snapshot(), copy = structuredClone(saved);
  for (let i = 0; i < 9; i++) marshWeather.update(.09);
  marshWeather.restore(copy); expect(marshWeather.snapshot()).toEqual(saved);
  expect(() => { marshWeather.restore({ ...saved, registers: { other: 1 } }); }).toThrow(); expect(marshWeather.snapshot()).toEqual(saved);
});

test('rows refuse registers, states and actions their program does not declare', () => {
  const step = marsh.steps[1];
  if (step === undefined) throw new Error('Missing fixture step');
  for (const rows of [{ ...marsh, flash: 'missing' }, { ...marsh, active: ['snow'] }, { ...marsh, actions: { event: 'missing' } }, { ...marsh, hz: 30 },
    { ...marsh, steps: [{ ...step, write: [['low', 'register.missing']] }] }, { ...marsh, steps: [{ ...step, observe: [['dt', 'clock']] }] }])
    expect(() => parseWeatherReactions(rows, program)).toThrow();
});

test('event records keep their last fields and age; raise fires a declared event', () => {
  const marshWeather = install(), heard: number[] = [];
  expect(marshWeather.record('flicker')).toEqual({ far: 0, towards: 0, age: 1e6 });
  marshWeather.on('flicker', event => { heard.push(event['far'] ?? 0); });
  marshWeather.raise('flicker', { far: 40, towards: 1 });
  expect(heard).toEqual([40]); expect(marshWeather.record('flicker')['age']).toBe(0);
  marshWeather.update(.05); expect(marshWeather.record('flicker')['age']).toBeCloseTo(.05);
  const before = {...marshWeather.record('flicker')}, faults: Fault[] = [], off = onFault(fault => {faults.push(fault);});
  try {
    for (let frame = 0; frame < 2; frame++) {
      expect(() => {marshWeather.raise('flicker', {far: 999, age: 3});}).not.toThrow();
      expect(() => {marshWeather.raise('missing', {});}).not.toThrow();
    }
    expect(marshWeather.record('flicker')).toEqual(before); expect(heard).toEqual([40]);
    expect(faults).toHaveLength(2); expect(faults.every(fault => fault.verdict === 'retry')).toBe(true);
    marshWeather.raise('flicker', {far: 41}); expect(heard).toEqual([40, 41]);
  } finally {off();}
});

test('nonfinite frame clocks leave weather and reaction continuation untouched and report once', () => {
  const reactions = install(); reactions.raise('flicker', {far: 3});
  const before = reactions.snapshot(), faults: Fault[] = [], off = onFault(fault => {faults.push(fault);});
  try {
    for (const delta of [Number.NaN, Infinity]) expect(reactions.update(delta)).toBe(false);
    expect(reactions.snapshot()).toEqual(before); expect(faults).toHaveLength(1);
    expect(faults[0]).toMatchObject({system: 'weather.reactions', verdict: 'retry'});
    reactions.update(.05); expect(reactions.record('flicker')['age']).toBeCloseTo(.05);
  } finally {off();}
});

test('an event binding lost after admission skips only that emission and keeps later declared events running', () => {
  const reactions = install(), faults: Fault[] = [], heard: number[] = [];
  reactions.weather.force('rain', .2); reactions.weather.hold = true;
  const step = reactions.rows.steps[0], emission = step?.emit[0];
  if (step === undefined || emission === undefined) throw new Error('Missing admitted weather emission');
  step.emit.unshift({...emission, event: 'missing'});
  reactions.on('flicker', event => {heard.push(event['far'] ?? 0);});
  const off = onFault(fault => {faults.push(fault);});
  try {
    expect(() => {reactions.update(.2); reactions.update(.2);}).not.toThrow();
    expect(heard).toHaveLength(2); expect(heard.every(distance => distance >= 500 && distance <= 1200)).toBe(true);
    expect(faults).toHaveLength(1); expect(faults[0]).toMatchObject({system: 'weather.reactions', verdict: 'retry'});
    expect(() => reactions.record('missing')).toThrow('Undeclared');
  } finally {off();}
});

test('hud rows name the phase, count it down and report only changes', () => {
  const marshWeather = install({ ...marsh, hud: { chips: [{ state: 'rain', title: 'Rain {left}', tone: 'storm' }], sub: 'WIND {wind}', low: 'low' } });
  marshWeather.weather.force('rain', .5); marshWeather.weather.hold = true;
  const left = Math.ceil(marshWeather.weather.phaseLeft);
  expect(marshWeather.hud(7.4, false)).toEqual({ chip: { title: `Rain ${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}`, sub: 'WIND 7', tone: 'storm' }, getLow: false });
  expect(marshWeather.hud(7.4, false)).toBeNull();
  marshWeather.weather.registers['low'] = 1; expect(marshWeather.hud(7.4, true)).toBeNull(); expect(marshWeather.hud(7.4, false)?.getLow).toBe(true);
  expect(() => install({ ...marsh, hud: { chips: [{ state: 'snow', title: '', tone: 'storm' }], sub: '', low: 'low' } })).toThrow();
});


test('marsh damage rows bind native health once per entered lifetime',()=>{
  const first=marsh.steps[0];if(first===undefined)throw new Error('Missing marsh step');
  const weather=install({...marsh,steps:[{...first,emit:[...first.emit,{event:'hurt',when:'notEmitted',fields:[['damage','input.py']]}]}]}),app=new App(),walker=fakeWorld().player;
  const policy={step:'marsh.weather',scareRadius:10,windReference:8,light:{base:.2,storm:.4,ramps:[]},
    hit:{ask:'weather.damage',tags:['env.marsh','cover.checked'],cause:{kind:'rain',label:'Cold rain',text:'Cold rain'},toast:'Find shelter'}};
  const health=new PlayerHealth(app.events,{now:()=>0,dodging:()=>false,dodgeGuard:()=>false,position:()=>walker.position});
  const scope=new Scope('marsh.weather.play'),next=new Scope('marsh.weather.return');
  try{
    app.levelScope=scope;app.registerPlayer(health,scope);app.events.answer('weather.damage',amount=>amount+1,scope);
    bindPageWeatherHit(legacyDouble<ShardContext>({app,scope}),walker,weather,policy);
    weather.raise('hurt',{damage:4});expect(health.attributes.health).toBe(95);
    scope.dispose();app.levelScope=next;app.registerPlayer(health,next);
    bindPageWeatherHit(legacyDouble<ShardContext>({app,scope:next}),walker,weather,policy);
    weather.raise('hurt',{damage:5});expect(health.attributes.health).toBe(90);
  }finally{scope.dispose();next.dispose();}
});


test('weather listener cleanup is idempotent during dispatch',()=>{
  const weather=install(),seen:string[]=[];
  let remove:()=>void=()=>undefined;
  remove=weather.on('flicker',()=>{seen.push('first');remove();remove();});
  weather.on('flicker',()=>{seen.push('second');});
  weather.raise('flicker',{far:600,towards:1});weather.raise('flicker',{far:700,towards:1});
  expect(seen).toEqual(['first','second','second']);
});

test('a storm frame\'s cover holds the weather and sets covered / held as the page forest did', () => {
  for (const indoors of [false, true]) for (const held of [false, true]) {
    const air = { hold: !(indoors || held) }, inputs: Record<string, number> = { px: 1, covered: 9, sheltered: 0, held: 9 };
    applyWeatherCover(air, inputs, indoors, held);
    // the page's three assignments, verbatim
    const page = { hold: !(indoors || held) }, pageInputs: Record<string, number> = { px: 1, covered: 9, sheltered: 0, held: 9 };
    page.hold = indoors || held; pageInputs['covered'] = Number(indoors || held); pageInputs['held'] = Number(held);
    expect([air, Object.entries(inputs)]).toEqual([page, Object.entries(pageInputs)]);
  }
});
