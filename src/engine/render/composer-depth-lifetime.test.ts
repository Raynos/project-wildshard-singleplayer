import { expect, test } from 'vitest';
import { DepthEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { Texture, WebGLRenderTarget } from 'three';
import { ownComposerDepth } from './composerDepth';
import { MemoryAttribution } from '../core/memoryAttribution';

const isTexture = (value: unknown): value is Texture => value instanceof Texture;

function createDepth(composer: EffectComposer): Texture {
  const create: unknown = Reflect.get(composer, 'createDepthTexture');
  if (typeof create !== 'function') throw new Error('Pinned postprocessing depth factory missing');
  Reflect.apply(create, composer, []);
  const depth: unknown = Reflect.get(composer, 'stableDepthTexture');
  if (!isTexture(depth)) throw new Error('Composer did not create a stable depth texture');
  return depth;
}

for (const targetInitialized of [false, true]) test(`composer releases sampled depth when target initialized=${String(targetInitialized)}`, () => {
  const composer = new EffectComposer(), ledger = new MemoryAttribution(), handles: object[] = [];
  ownComposerDepth(composer);
  // Depth-slice passes sample the stable texture without binding its render target.
  // Three installs the texture's native disposal hook on sampling; the target's
  // native disposal hook exists only after initRenderTarget / setRenderTarget.
  try {
    for (let visit = 0; visit < 5; visit++) {
      const pass = new EffectPass(undefined, new DepthEffect()); pass.needsDepthTexture = true; composer.passes.push(pass);
      const depth = createDepth(composer), native = {}; handles.push(native);
      pass.setDepthTexture(depth);
      ledger.allocation(native, 'gpu', 'texture', 4_380_192);
      let disposals = 0;
      depth.addEventListener('dispose', () => { disposals++; ledger.release(native, 'gpu'); });
      const target: unknown = Reflect.get(composer, 'depthRenderTarget');
      if (!(target instanceof WebGLRenderTarget)) throw new Error('Stable depth target missing');
      if (targetInitialized) target.addEventListener('dispose', () => { depth.dispose(); });
      composer.removePass(pass);
      expect(pass.getDepthTexture()).toBeNull();
      expect(disposals).toBe(1);
      expect(ledger.summary().totals.gpu).toBe(0);
      pass.dispose();
    }
    expect(handles).toHaveLength(5);
  } finally { composer.dispose(); }
});

for (const retire of ['removeAllPasses', 'dispose', 'reset'] as const) test(`${retire} releases an uninitialized depth target's uploaded sampler`, () => {
  const composer = new EffectComposer(); ownComposerDepth(composer);
  const depth = createDepth(composer), ledger = new MemoryAttribution(), native = {};
  ledger.allocation(native, 'gpu', 'texture', 4_380_192);
  depth.addEventListener('dispose', () => { ledger.release(native, 'gpu'); });
  try {
    composer[retire](); expect(ledger.summary().totals.gpu).toBe(0);
  } finally { composer.dispose(); }
});

test('removing an unrelated pass keeps depth available to a remaining reader', () => {
  const composer = new EffectComposer(); ownComposerDepth(composer);
  const reader = new EffectPass(undefined, new DepthEffect()), unrelated = new RenderPass(); reader.needsDepthTexture = true;
  composer.passes.push(reader, unrelated); const depth = createDepth(composer); reader.setDepthTexture(depth);
  let disposals = 0; depth.addEventListener('dispose', () => { disposals++; });
  try {
    composer.removePass(unrelated); expect(disposals).toBe(0); expect(reader.getDepthTexture()).toBe(depth);
    composer.removePass(reader); expect(disposals).toBe(1);
  } finally { composer.dispose(); reader.dispose(); unrelated.dispose(); }
});
