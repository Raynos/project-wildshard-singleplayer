import { describe, expect, it, vi } from 'vitest';
import { Vector3, type Material } from 'three';
import { Boundary } from '#engine/world/Boundary';
import { Horizon } from '#engine/world/Horizon';
import { configureLevel } from '#engine/level/selection';
import { toLevelSpec } from '#game/shard/spec';
import { SHARDS } from '../../src/shards.generated';

vi.mock('#engine/world/Heightfield', () => ({ heightAt: () => 0, waterLevel: () => 0, pondMask: () => 0, streamAt: () => null }));

describe('authored world dressing', () => {
  it('hides all boundary drawing before allocating geometry or materials', () => {
    const setupMaterial = vi.fn<(material: Material) => void>();
    const boundary = new Boundary({ setupMaterial }, { visible: false }).build();
    expect(boundary.group.children).toHaveLength(0);
    boundary.update(1, 10);
    expect(setupMaterial).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { visible: true }])('keeps default boundary geometry with %j', (spec) => {
    const previous = globalThis.document;
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({
      createRadialGradient: () => ({ addColorStop: vi.fn() }), fillStyle: '', fillRect: vi.fn(),
    }) }) });
    try {
      const boundary = new Boundary({ setupMaterial: vi.fn<(material: Material) => void>() }, spec).build();
      expect(boundary.group.children.length).toBeGreaterThan(0);
    } finally { vi.stubGlobal('document', previous); }
  });

  it('accepts an empty authored horizon and reshapes a ring from compass bands', () => {
    const first = SHARDS[0]; if (first === undefined) throw new Error('No manifests');
    const level = toLevelSpec(first);
    configureLevel({ ...level, horizon: { rings: [], cloudSea: false } });
    const sky = { setupMaterial: vi.fn<(material: Material) => void>(), sunDir: new Vector3(0, 1, 0), night: 0 };
    expect(new Horizon(sky).build().group.children).toHaveLength(0);
    configureLevel({ ...level, horizon: { rings: [{ r: 1400, base: 10, color: [0.1, 0.2, 0.3], top: [0.4, 0.5, 0.6], snowLine: 2, haze: 0.4, floor: -100,
      bands: [{ azimuth: 180, spread: 80, height: 200, rough: 0.5 }] }], cloudSea: false } });
    const horizon = new Horizon(sky).build();
    expect(horizon.group.children).toHaveLength(1);
    expect(sky.setupMaterial).toHaveBeenCalledOnce();
    configureLevel(level);
  });
});
