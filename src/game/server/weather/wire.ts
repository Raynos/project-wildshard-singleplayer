import type { SimHost } from '@wildshard/engine/sim';
import { publishWorldState, type StateNetRow } from '@wildshard/engine/sim/shardRows';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import { WEATHER_ROW } from '../../shared/weather/feed';
import type { WeatherReactions } from './reactions';

interface Row { readonly name: string; value: number }

/** Publish a sky as `state` rows, read only when a room samples them. A client's `netClimate` reads them back. */
export function publishWeather(host: SimHost, air: WeatherContinuation): void {
  const phase: Row = { name: WEATHER_ROW.phase, value: 0 }, left: Row = { name: WEATHER_ROW.left, value: 0 };
  const numbers = Object.keys(air.n).map(id => ({ id, row: { name: WEATHER_ROW.number(id), value: 0 } }));
  const registers = Object.keys(air.registers).map(id => ({ id, row: { name: WEATHER_ROW.register(id), value: 0 } }));
  const rows: readonly StateNetRow[] = [phase, left, ...numbers.map(({ row }) => row), ...registers.map(({ row }) => row)];
  publishWorldState(host, 'weather', () => {
    phase.value = air.profile.states.indexOf(air.state); left.value = Math.ceil(air.phaseLeft); // the HUD counts whole seconds, and a whole second is a row a second
    for (const { id, row } of numbers) row.value = air.n[id] ?? 0;
    for (const { id, row } of registers) row.value = air.registers[id] ?? 0;
    return rows;
  });
}

/** Publish a storm's events: each one's last fields and a serial that says it was raised again. */
export function publishStorm(host: SimHost, storm: WeatherReactions): void {
  const events = [...new Set(storm.rows.steps.flatMap(step => step.emit.map(row => row.event)))].map(event => {
    const serial: Row = { name: WEATHER_ROW.serial(event), value: 0 }, fields = Object.keys(storm.record(event)).filter(field => field !== 'age').map(field => ({ field, row: { name: WEATHER_ROW.field(event, field), value: 0 } }));
    storm.on(event, () => { serial.value++; });
    return { event, serial, fields };
  });
  const rows: readonly StateNetRow[] = events.flatMap(({ serial, fields }) => [serial, ...fields.map(({ row }) => row)]);
  publishWorldState(host, 'storm', () => {
    for (const { event, fields } of events) { const record = storm.record(event); for (const { field, row } of fields) row.value = record[field] ?? 0; }
    return rows;
  });
}
