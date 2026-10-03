import { jsonSlot } from '#engine';
import type { ShardContext } from '#game';
import { GOLDEN_LOOKS, useGoldenLook } from '../look/dayKeys';

export const CRAG_VIEWS = ['shaded', 'ao', 'sun', 'wet', 'normal', 'albedo'] as const;
const LIFE = ['on', 'off'] as const;
const PICKS = { pineLife: LIFE, cragView: CRAG_VIEWS, goldenLight: GOLDEN_LOOKS };
type Key = keyof typeof PICKS;

/** Retain the previous menu pick while the level's row acquires its own device slot. */
export function pineOption<K extends Key>(key: K): (typeof PICKS)[K][number] {
  const choices = PICKS[key];
  const saved = jsonSlot(`debug.plugin.pine-hollow.${key}`, 'device').read();
  const legacy = jsonSlot('settings', 'global').read();
  const value = saved ?? (legacy !== null && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy[key] : undefined);
  return choices.find((choice) => choice === value) ?? choices[0];
}

export function installPineDebug(ctx: ShardContext, cragView: (value: string) => void): void {
  ctx.debugRow({ id: 'pineLife', group: 'creatures', label: 'Pine Hollow life', choices: LIFE.map((value) => ({ value, text: value === 'on' ? 'On' : 'Off' })), initial: pineOption('pineLife'), reload: true,
    change: () => undefined, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: birds, hares, ravens and the skinning beat.' });
  const golden = pineOption('goldenLight');
  useGoldenLook(golden);
  ctx.debugRow({ id: 'goldenLight', group: 'look', label: 'Pine golden light', choices: GOLDEN_LOOKS.map((value) => ({ value, text: value === 'e401' ? 'E401 (warm sun, dimmer sky)' : 'Before E401' })), initial: golden, reload: true,
    change: () => undefined, ask: 'E423', reviewBy: '2026-10-10', note: 'E401 re-tuned the golden and morning keys; Jake picks between the two (decision page D15).' });
  const initial = pineOption('cragView');
  cragView(initial);
  ctx.debugRow({ id: 'cragView', group: 'tools', label: 'Crag channel', choices: CRAG_VIEWS.map((value) => ({ value, text: value === 'shaded' ? 'Shaded' : value === 'ao' ? 'AO' : value[0]?.toUpperCase() + value.slice(1) })), initial,
    change: cragView, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: inspect one crag shading channel.' });
}
