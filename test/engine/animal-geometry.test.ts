import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry } from 'three';
import { mergeAnimalGeometry } from '../../src/engine/models/animalGeometry';

describe('optional procedural creature geometry groups', () => {
  it.each([0, 1, 2])('accepts one populated group and keeps material slot %i', (material) => {
    const source = new BoxGeometry(), disposed = vi.fn<() => void>(); source.addEventListener('dispose', disposed);
    const groups = [[], [], []].map((_, index) => index === material ? [source] : []);
    const geometry = mergeAnimalGeometry(groups[0] ?? [], groups[1] ?? [], groups[2] ?? []);
    expect(geometry.groups).toEqual([{ start: 0, count: 36, materialIndex: material }]);
    expect(geometry.getAttribute('position').count).toBe(source.getAttribute('position').count);
    expect(disposed).toHaveBeenCalledOnce(); geometry.dispose();
  });
  it('preserves the original three group ranges and material order', () => {
    const geometry = mergeAnimalGeometry([new BoxGeometry()], [new BoxGeometry()], [new BoxGeometry()]);
    expect(geometry.groups).toEqual([{ start: 0, count: 36, materialIndex: 0 }, { start: 36, count: 36, materialIndex: 1 }, { start: 72, count: 36, materialIndex: 2 }]);
    expect(geometry.index?.count).toBe(108); geometry.dispose();
  });
  it('rejects an entirely empty species with a clear contract error', () => {
    expect(() => mergeAnimalGeometry([], [], [])).toThrow('A species needs at least one geometry part');
  });
});
