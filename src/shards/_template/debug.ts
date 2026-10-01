import type { ShardContext } from '#game';
import type { TemplateLantern } from './weapons/TemplateLantern';
import { STRINGS } from './strings';

export function installDebug(ctx: ShardContext, lantern: TemplateLantern): void {
  ctx.debugRow({ id: 'template.oil', group: 'tools', label: STRINGS.debug, choices: [{ value: 'keep', text: STRINGS.keep }, { value: 'refill', text: STRINGS.refill }],
    initial: 'keep', change: (value) => { if (value === 'refill') lantern.oil = 1; }, note: STRINGS.debugNote, ask: 'E357', reviewBy: '2026-12-01' });
}
