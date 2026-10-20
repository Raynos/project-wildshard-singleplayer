/**
 * The steppe's sky and storm on the page's weather host (sdk/looks/forestWeather). The painted sky (game/looks/keyedSky
 * `paintedSky`): the day clock, the day key and look (skyPresentation.ts, dayChannels.ts) under the weather and tint rows
 * (weatherChannels.ts) and the dome of world/weather-fx.json. The storm: the reactions of world/weather.json (bolts, GET LOW
 * and the wind it asks for, at 10 Hz: weatherDecision.mjs) struck at the spruce crowns and sheltered by the yurts; the thunder
 * and the crackle at their events; the rain and storm-wind beds; and the drawn storm (the deck, the curtains, the bolt, the
 * strike's smoke and fire, the telegraph's glow, the puddles, the rain round the eye), posed by the `nalati.fx` rows
 * (weatherFxChannels.ts) over the shapes and textures of world/weather-fx.json (weatherPresentation.ts).
 */
import { nalatiDayClockRow } from './dayClock';

const LOOKS = { deck: 'nalati-storm-deck', curtains: 'nalati-storm-curtains', bolt: 'nalati-lightning-bolt', smoke: 'nalati-strike-smoke', puddles: 'nalati-puddles' } as const;

export const NALATI_WEATHER_PAGE = {
  files: {}, mode: 'live', debug: 'nalati.weather', heldPhase: 0,
  sky: {
    file: 'world/weather-fx.json', clock: nalatiDayClockRow(), dome: { shape: 'sky', look: 'nalati-sky-dome', order: -100 }, flash: 0.7,
    lanes: { key: 'nalati.day', sample: 'nalati.sky.sample', dome: 'nalati.sky.dome', weather: 'weather', tint: 'tint' }, tint: ['nalati-water'],
    from: { fog: 'fog', shade: 'shade', rim: 'rim', light: 'sunI' },
    moon: { disc: [0.85, 0.9, 1], gain: 1.4, scale: 0.55, halo: 0.5, haloOpacity: 0.35 },
  },
  storm: {
    file: 'world/weather.json', idle: 'clear', native: { file: 'sim/headless-assembly.json', shelters: 'nativeShelters', world: 'nativeWeather' },
    cues: [
      { event: 'telegraph', patch: 'lightningCrackle', kind: 'near', range: 160, floor: 0.15, reach: 0 },
      { event: 'flash', patch: 'thunder', kind: 'distant', range: 0, floor: 0, reach: 100 },
    ],
    beds: { group: 'storm', every: 0.25, rain: 'rain', wind: 'stormwind', range: [6, 22] },
  },
  parts: {
    file: 'world/weather-fx.json', lane: 'nalati.fx', params: Object.values(LOOKS),
    textures: [
      { id: 'noise', bytes: 'noise', size: 128, noise: true, lend: [[LOOKS.deck, 'tNoise'], [LOOKS.curtains, 'tNoise']] },
      { id: 'glow', bytes: 'glow', size: 128, noise: false, lend: [] },
      { id: 'fire', bytes: 'fire', size: 128, noise: false, lend: [] },
    ],
    parts: [
      { kind: 'mesh', id: 'deck', shape: 'deck', look: LOOKS.deck, order: -9 },
      { kind: 'mesh', id: 'curtains', shape: 'curtains', look: LOOKS.curtains, order: -8 },
      { kind: 'mesh', id: 'bolt', shape: 'bolt', look: LOOKS.bolt, order: 15 },
      { kind: 'points', id: 'smoke', shape: 'smoke', look: LOOKS.smoke, order: 9 },
      { kind: 'instanced', id: 'puddles', shape: 'puddles', look: LOOKS.puddles, order: 2, matrices: 'puddles' },
      { kind: 'sprite', id: 'glow', texture: 'glow', order: 12, fog: false, toneMapped: false },
      { kind: 'sprite', id: 'fire', texture: 'fire', order: 11, fog: false, toneMapped: true },
    ],
    rain: { look: 'nalati-rain', radius: { phone: 11, desktop: 16 }, streaks: { phone: 3500, desktop: 6000 }, order: 20 },
  },
  system: { id: 'shard.nalati.weather', after: ['shard.nalati.pois'], before: ['shard.nalati.weather.fx'] },
};
