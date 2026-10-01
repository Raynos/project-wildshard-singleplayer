import { expect, it } from 'vitest';
import { PineWeather } from '#shards/pine-hollow/world/weatherProfile';
import { SteppeStorm } from '#shards/nalati-grasslands/world/Weather';
import { Weather } from '#engine/world/weather';
import { Scope } from '#engine/app/scope';
import { Events } from '#engine/events/events';
import frozen from './fixtures/weather-e357.json';

/** Recorded from original152c5409 classes, including RNG-shared Nalati lightning/gust state. */
it('Pine three-hour seeded state/length/output sequence equals the original', () => {
  const w = new PineWeather({ seed: 1337 });
  expect(w).toBeInstanceOf(Weather);
  let j = 0, prev = w.state;
  for (let i = 0; i < 10800; i++) {
    w.update(1, i / 1440 % 1);
    if (i % 30 === 0 || w.state !== prev) expect([i + 1, w.state, w.phaseT, w.phaseLen, w.overcast, w.rain, w.wet, w.wind, w.fog]).toEqual(frozen.pine[j++]);
    prev = w.state;
  }
});
it('Nalati three-hour state/length/rain/wind/lightning sequence equals the original', () => {
  const w = new SteppeStorm({ seed: 1337, world: { heightAt: () => 0, exposed: () => undefined, player: () => ({ x: 0, y: 0, z: 0, crouched: false, mounted: false, sheltered: false }) } });
  expect(w).toBeInstanceOf(Weather);
  let j = 0, prev = w.state;
  for (let i = 0; i < 10800; i++) {
    w.update(1);
    if (i % 30 === 0 || w.state !== prev) expect([i + 1, w.state, w.phaseT, w.phaseLen, w.overcast, w.rain, w.wet, w.front, w.rainbow, w.flash, w.windSpeed, w.windGustiness, w.getLow, w.pending]).toEqual(frozen.nalati[j++]);
    prev = w.state;
  }
});
it('phase observers unsubscribe with their owner scope', () => {
  const w = new PineWeather({ seed: 1 }), scope = new Scope('observer');
  const seen: string[] = []; w.onPhase((state) => { seen.push(state); }, scope);
  w.force('rain'); scope.dispose(); w.force('clearing');
  expect(seen).toEqual(['rain']);
});
it('weather requests retain caller values and release scripted modifiers at disposal', () => {
  const events = new Events(), scope = new Scope('boss');
  expect(events.ask('weather.hold', .25)).toBe(.25);
  expect(events.ask('weather.damage', 60)).toBe(60);
  events.answer('weather.hold', (hold) => Math.max(hold, .8), scope);
  events.answer('weather.damage', (damage) => damage * .5, scope);
  expect(events.ask('weather.hold', .25)).toBe(.8);
  expect(events.ask('weather.damage', 60)).toBe(30);
  scope.dispose();
  expect(events.ask('weather.hold', .25)).toBe(.25);
  expect(events.ask('weather.damage', 60)).toBe(60);
});
