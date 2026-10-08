import { afterEach, expect, it, vi } from 'vitest';
import { Mesh, MeshStandardMaterial, ShaderMaterial, Texture, Vector3, type WebGLRenderer } from 'three';
import { sceneResources } from '../../../src/engine/app/sceneOwnership';
import { loadPainted } from '../../../src/shards/far-reach/look/image';
import { firSheet, setFirSheet } from '../../../src/shards/far-reach/world/fir';
import { paintIsleMaterial, setIsleTextures } from '../../../src/shards/far-reach/world/isle';
import { setMillTextures, towerMill } from '../../../src/shards/far-reach/world/mill';
import { crownStorm, setStormPaint } from '../../../src/shards/far-reach/world/storm';
import { legacyDouble } from '../../fake/FakeGame';

const originalFetch = globalThis.fetch;
const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBitmap === undefined) Reflect.deleteProperty(globalThis, 'createImageBitmap');
  else Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap);
});

it('closes each painted bitmap exactly once at retirement and reconstructs a fresh source on the next admission', async () => {
  const close = vi.fn<() => void>();
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Blob(['paint']))));
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 4, height: 4, close } satisfies ImageBitmap));
  let previous: Texture | null = null;
  for (let visit = 0; visit < 3; visit++) {
    const texture = await loadPainted('/fixture.webp', 'fixture', true);
    if (texture === null) throw new Error('Painted fixture failed to decode');
    expect(texture).not.toBe(previous); previous = texture;
    expect(close).toHaveBeenCalledTimes(visit);
    texture.dispose(); texture.dispose();
    expect(close).toHaveBeenCalledTimes(visit + 1);
  }
});

it('forgets all four real builder sampler globals without an older retirement clearing newer assignments', () => {
  const old = new Texture(), current = new Texture(), noise = new Texture();
  const assign = (texture: Texture): void => {
    setFirSheet(texture); setIsleTextures({ rock: texture, meadow: texture });
    setMillTextures({ stone: texture, canvas: texture, ivy: texture }); setStormPaint(texture);
  };
  const read = (expected: Texture | null): void => {
    expect(firSheet()).toBe(expected);
    const material = paintIsleMaterial(new MeshStandardMaterial());
    const shader = legacyDouble<Parameters<typeof material.onBeforeCompile>[0]>({ vertexShader: '', fragmentShader: '#include <color_fragment>', uniforms: {} });
    material.onBeforeCompile(shader, legacyDouble<WebGLRenderer>({}));
    expect(shader.uniforms['farRock']?.value ?? null).toBe(expected);
    expect(shader.uniforms['farMeadow']?.value ?? null).toBe(expected);
    material.dispose();
    const mill = towerMill(), storm = crownStorm(new Vector3(0, 1, 0), noise, () => 0.5);
    const maps = new Set<Texture>();
    mill.group.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshStandardMaterial && node.material.map !== null) maps.add(node.material.map); });
    expect(maps).toEqual(expected === null ? new Set() : new Set([expected]));
    const cloud = storm.group.children[0];
    if (!(cloud instanceof Mesh) || !(cloud.material instanceof ShaderMaterial)) throw new Error('Missing actual storm material');
    expect(cloud.material.uniforms['paint']?.value).toBe(expected);
    for (const root of [mill.group, storm.group]) for (const resource of sceneResources(root)) if (!(resource instanceof Texture)) resource.dispose();
  };
  try {
    assign(old); assign(current); old.dispose(); read(current);
    current.dispose(); read(null);
  } finally { old.dispose(); current.dispose(); noise.dispose(); }
});
