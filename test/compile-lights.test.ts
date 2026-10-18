import { describe, expect, it, vi } from 'vitest';
import { DepthTexture, DirectionalLight, Group, WebGLRenderTarget } from 'three';
import { LightsNode } from 'three/webgpu';
import { CompileLights } from '../src/engine/render/compileLights';

function lightCopy(lights: CompileLights, source: DirectionalLight): DirectionalLight {
  const copy = lights.copy(source);
  if (!(copy instanceof DirectionalLight)) throw new Error('Expected a directional compile light');
  return copy;
}

function target(): WebGLRenderTarget {
  const map = new WebGLRenderTarget(16, 16);
  map.depthTexture = new DepthTexture(16, 16);
  return map;
}

describe('compile-only light storage', () => {
  it('borrows the live shadow without changing or disposing its light and map', () => {
    const lights = new CompileLights(), source = new DirectionalLight();
    source.castShadow = true; source.intensity = 2;
    source.shadow.map = target(); source.shadow.needsUpdate = true;
    const disposed = vi.fn(); source.shadow.map.addEventListener('dispose', () => { disposed(); });
    const copy = lightCopy(lights, source), root = new Group(); root.add(copy);
    lights.prepare();
    expect(copy.castShadow).toBe(true); expect(copy.intensity).toBe(source.intensity);
    expect(copy.shadow.map).toBe(source.shadow.map);
    expect(copy.shadow.autoUpdate).toBe(false); expect(copy.shadow.needsUpdate).toBe(false);
    lights.dispose(); lights.dispose();
    expect(disposed).not.toHaveBeenCalled(); expect(copy.parent).toBeNull();
    expect(source.shadow.needsUpdate).toBe(true); expect(source.shadow.map).not.toBeNull();
    source.dispose();
  });

  it('releases private warm-up maps on success or failure, including after a source resize', () => {
    for (const fail of [false, true]) {
      const lights = new CompileLights(), source = new DirectionalLight(), copy = lightCopy(lights, source);
      const privateMap = target(), retired = vi.fn(); privateMap.addEventListener('dispose', () => { retired(); });
      try {
        lights.prepare(); expect(copy.shadow.needsUpdate).toBe(true);
        copy.shadow.map = privateMap;
        lights.prepare(); expect(copy.shadow.map).toBe(privateMap); expect(copy.shadow.needsUpdate).toBe(false);
        if (fail) throw new Error('Warm cancelled');
        source.shadow.map = target();
        lights.prepare(); expect(retired).toHaveBeenCalledOnce(); expect(copy.shadow.map).toBe(source.shadow.map);
        const replacement = target(); source.shadow.map.dispose(); source.shadow.map = replacement;
        lights.prepare(); expect(copy.shadow.map).toBe(replacement);
      } catch (error) { expect(String(error)).toContain('Warm cancelled'); }
      finally { lights.dispose(); }
      expect(retired).toHaveBeenCalledOnce(); source.dispose();
    }
  });
  it('borrows actual node identities only during compile and retains source ownership', () => {
    for (const allocated of [false, true]) {
      const lights = new CompileLights(), source = new DirectionalLight(), live = new Group(), root = new Group();
      const child = new Group(); source.add(child); live.add(source);
      source.shadow.map = allocated ? target() : null;
      const existing = source.shadow.map, children = source.children;
      const key = (light: DirectionalLight): number => new LightsNode().setLights([light]).getCacheKey();
      const expectedKey = key(source);
      const copy = lightCopy(lights, source); root.add(copy); lights.prepare();
      const restore = lights.borrowSources();
      try {
        expect(root.children).toEqual([source]); expect(source.id).not.toBe(copy.id);
        const selected = root.children[0]; if (!(selected instanceof DirectionalLight)) throw new Error('Missing compile source');
        expect(key(selected)).toBe(expectedKey); expect(key(copy)).not.toBe(expectedKey);
        expect(source.parent).toBe(live); expect(live.children).toEqual([source]);
        expect(source.children).toEqual([]); expect(child.parent).toBe(source);
        if (allocated) { expect(source.shadow.autoUpdate).toBe(false); expect(source.shadow.needsUpdate).toBe(false); }
        else source.shadow.map = target();
      } finally { restore(); restore(); }
      expect(root.children).toEqual([copy]); expect(copy.parent).toBe(root);
      expect(source.children).toBe(children); expect(source.parent).toBe(live);
      expect(source.shadow.autoUpdate).toBe(true); expect(source.shadow.needsUpdate).toBe(!allocated);
      if (existing !== null) expect(source.shadow.map).toBe(existing);
      const disposed = vi.fn(); source.shadow.map?.addEventListener('dispose', () => { disposed(); });
      lights.dispose(); expect(disposed).not.toHaveBeenCalled(); source.dispose();
    }
  });

});
