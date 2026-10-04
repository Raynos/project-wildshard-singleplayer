import { jsonSlot } from '@wildshard/engine/saves/slots';
import type { ShardContext } from '@wildshard/game/shard/context';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';

export const CRAG_VIEWS = ['shaded', 'ao', 'sun', 'wet', 'normal', 'albedo'] as const;
const LIFE = ['on', 'off'] as const;
const TRIM = ['off', 'on'] as const;
const PICKS = { pineLife: LIFE, cragView: CRAG_VIEWS, pineMemoryTrim: TRIM };
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
  const initial = pineOption('cragView');
  cragView(initial);
  ctx.debugRow({ id: 'cragView', group: 'tools', label: 'Crag channel', choices: CRAG_VIEWS.map((value) => ({ value, text: value === 'shaded' ? 'Shaded' : value === 'ao' ? 'AO' : value[0]?.toUpperCase() + value.slice(1) })), initial,
    change: cragView, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: inspect one crag shading channel.' });
  // SF47-g (E435): Pine's own invisible memory cuts (look/skyKeyFormat.ts); retires under G112 once parity and the quiet
  // frame floor are green (the row and the off path go)
  // (registered like Driftwood's reload variants; look/render.ts reads the pick from the row's device slot at boot)
  runtimeVariantEnabled(ctx, { id: 'pineMemoryTrim', group: 'loading', label: 'Pine memory trim', choices: TRIM.map((value) => ({ value, text: value === 'on' ? 'On' : 'Off' })), initial: pineOption('pineMemoryTrim'), reload: true,
    ask: 'E435', reviewBy: '2026-12-30', note: 'E435 SF47-g: the HDRI sky keys as RGB9_E5 (half their GPU bytes, no look change).' });
}
