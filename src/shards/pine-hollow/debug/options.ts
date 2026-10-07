import { jsonSlot } from '@wildshard/engine/saves/slots';
import type { ShardContext } from '@wildshard/game/shard/context';
import { developerToolsEnabled, gridPage, runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';

export const CRAG_VIEWS = ['shaded', 'ao', 'sun', 'wet', 'normal', 'albedo'] as const;
const TRIM = ['off', 'on'] as const;
const PICKS = { cragView: CRAG_VIEWS, pineMemoryTrim: TRIM };
type Key = keyof typeof PICKS;

/** Retain the previous menu pick while the level's row acquires its own device slot. */
export function pineOption<K extends Key>(key: K): (typeof PICKS)[K][number] {
  const choices = PICKS[key];
  if (key !== 'pineMemoryTrim' && !developerToolsEnabled()) return choices[0];
  const saved = jsonSlot(`debug.plugin.pine-hollow.${key}`, 'device').read();
  const legacy = jsonSlot('settings', 'global').read();
  const value = saved ?? (legacy !== null && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy[key] : undefined);
  return choices.find((choice) => choice === value) ?? (key === 'pineMemoryTrim' && gridPage() ? 'on' : choices[0]);
}

/** G180 (Jake, E450): Pine's memory trim, on by default in the grid (standalone keeps off); an explicit pick wins */
export const pineMemoryTrim = (): boolean => pineOption('pineMemoryTrim') === 'on';
/** B1: the largest edge of Pine's building / Poly Haven PBR sets: 512² on the phone (a tier cap ≤ 1024) with the trim on,
 *  a quarter of the 1024² bytes; else the tier's own cap */
export const pineSetCap = (tierCap: number): number => (tierCap <= 1024 && pineMemoryTrim() ? Math.min(512, tierCap) : tierCap);

export function installPineDebug(ctx: ShardContext, cragView: (value: string) => void): void {
  const initial = pineOption('cragView');
  cragView(initial);
  ctx.debugRow({ purpose: 'developer', id: 'cragView', group: 'tools', label: 'Crag channel', choices: CRAG_VIEWS.map((value) => ({ value, text: value === 'shaded' ? 'Shaded' : value === 'ao' ? 'AO' : value[0]?.toUpperCase() + value.slice(1) })), initial,
    change: cragView, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: inspect one crag shading channel.' });
  // SF47-g (E435): Pine's own memory cuts: the invisible RGB9_E5 sky keys (look/skyKeyFormat.ts) and G180's visible B1 / B2
  // / B4 / B5 (Jake, E450; pineSetCap, boot/gpuTable.ts, look/skyBackdrop.ts, life/index.ts); on by default in the grid.
  // Retires under G112 once parity and the quiet frame floor are green (the row and the off path go)
  // (registered like Driftwood's reload variants; look/render.ts reads the pick from the row's device slot at boot)
  runtimeVariantEnabled(ctx, { id: 'pineMemoryTrim', group: 'loading', label: 'Pine memory trim', choices: TRIM.map((value) => ({ value, text: value === 'on' ? 'On' : 'Off' })), initial: pineOption('pineMemoryTrim'), reload: true,
    ask: 'E435', reviewBy: '2026-12-30', note: 'E435 SF47-g / G180: RGB9_E5 sky keys; on the phone 512² building sets, ASTC 6×6, a 128 environment cube, herd shadows from the visible herd. On by default in the grid.' });
}
