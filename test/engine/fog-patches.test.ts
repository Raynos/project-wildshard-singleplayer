import { describe, expect, it, vi } from 'vitest';
import { FOG_SLOT, fogPatches, installFogPatch } from '#engine/render/fogPatches';

describe('fog-patch registry (10 §X5)', () => {
  it('installs each patch once, in slot order, and reports an out-of-order slot', () => {
    const calls: string[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(installFogPatch('t.engine', FOG_SLOT.engine, () => { calls.push('engine'); })).toBe(true);
    expect(installFogPatch('t.engine', FOG_SLOT.engine, () => { calls.push('again'); })).toBe(false);
    expect(installFogPatch('t.level', FOG_SLOT.level, () => { calls.push('level'); })).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    expect(installFogPatch('t.stylize', FOG_SLOT.stylize, () => { calls.push('stylize'); })).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['engine', 'level', 'stylize']);
    expect(fogPatches().map((p) => p.id).slice(-3)).toEqual(['t.engine', 't.level', 't.stylize']);
  });
});
