import { describe, expect, it, vi } from 'vitest';
import { FOG_SLOT, FogPatchRegistry, type FogPatchEntry } from '#engine-internal/render/fogPatches';

// each test builds its own registry, not a fresh module (E422)

describe('fog-patch registry (10 §X5)', () => {
  it('rejects new out-of-order ids before either registry or shader installation changes', () => {
    const registry = new FogPatchRegistry(), installFogPatch = registry.install.bind(registry), fogPatches = (): readonly FogPatchEntry[] => registry.patches();
    const calls: string[] = [];
    expect(installFogPatch('t.engine', FOG_SLOT.engine, () => { calls.push('engine'); })).toBe(true);
    expect(installFogPatch('t.engine', FOG_SLOT.engine, () => { calls.push('again'); })).toBe(false);
    expect(installFogPatch('t.level', FOG_SLOT.level, () => { calls.push('level'); })).toBe(true);
    const before = [...fogPatches()], rejected = vi.fn<() => void>();
    expect(() => installFogPatch('t.stylize', FOG_SLOT.stylize, rejected)).toThrow('[fog] patch t.stylize');
    expect(() => installFogPatch('t.equal', FOG_SLOT.level, rejected)).toThrow('[fog] patch t.equal');
    expect(rejected).not.toHaveBeenCalled();
    expect(fogPatches()).toEqual(before);
    expect(installFogPatch('t.engine', FOG_SLOT.engine, rejected)).toBe(false);
    expect(rejected).not.toHaveBeenCalled();
    expect(calls).toEqual(['engine', 'level']);
    expect(fogPatches().map((p) => p.id).slice(-2)).toEqual(['t.engine', 't.level']);
    expect(() => installFogPatch('t.failed', 400, () => { throw new Error('installer failed'); })).toThrow('installer failed');
    expect(fogPatches()).toEqual(before);
    expect(installFogPatch('t.failed', 400, () => { calls.push('retry'); })).toBe(true);
  });
  it('keeps Nalati and Driftwood slot ordering independent when switching levels', () => {
    const registry = new FogPatchRegistry(), installFogPatch = registry.install.bind(registry), fogPatches = (): readonly FogPatchEntry[] => registry.patches();
    const engine = vi.fn<() => void>(), nalati = vi.fn<() => void>(), driftwood = vi.fn<() => void>();
    expect(installFogPatch('engine.fog', FOG_SLOT.engine, engine)).toBe(true);
    expect(installFogPatch('level.fog.nalati', FOG_SLOT.level, nalati, 'nalati')).toBe(true);
    expect(installFogPatch('level.fog.driftwood', FOG_SLOT.stylize, driftwood, 'driftwood')).toBe(true);
    const before = [...fogPatches()], rejected = vi.fn<() => void>();
    expect(() => installFogPatch('nalati.late', FOG_SLOT.stylize, rejected, 'nalati')).toThrow('nalati.late');
    expect(() => installFogPatch('driftwood.equal', FOG_SLOT.stylize, rejected, 'driftwood')).toThrow('driftwood.equal');
    expect(() => installFogPatch('engine.late', FOG_SLOT.engine, rejected)).toThrow('engine.late');
    expect(installFogPatch('level.fog.nalati', FOG_SLOT.level, rejected, 'driftwood')).toBe(false);
    expect(fogPatches()).toEqual(before);
    expect(rejected).not.toHaveBeenCalled();
    expect(engine).toHaveBeenCalledOnce();
    expect(nalati).toHaveBeenCalledOnce();
    expect(driftwood).toHaveBeenCalledOnce();
  });
});
