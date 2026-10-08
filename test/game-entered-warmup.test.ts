import { expect, it, vi } from 'vitest';
import { WebGLRenderTarget } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Game } from '../src/engine/core/Game';
import { warmComposerFrame } from '../src/engine/render/precompile';

function fixture() {
  const target = new WebGLRenderTarget(), render = vi.fn((_dt: number): void => undefined);
  const restore = vi.fn((_target: WebGLRenderTarget | null): void => undefined), owner = new Scope('entered');
  return { composer: { render }, renderer: { getRenderTarget: () => target, setRenderTarget: restore }, render, restore, owner, target };
}

it('leaves initial-boot shader and firstFrame stages to the ordinary loader', async () => {
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Game prototype');
  Reflect.set(game, '_composer', null);
  const owner = new Scope('initial'); await game.warmEnteredFrame(owner); owner.dispose();
});

it('resolves entered programs before drawing the real zero-delta composer and restores its target', async () => {
  const f = fixture(); let release = (): void => undefined;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const pending = warmComposerFrame(f.composer, f.renderer, () => barrier, () => !f.owner.disposed);
  expect(f.render).not.toHaveBeenCalled(); release(); await pending;
  expect(f.render).toHaveBeenCalledExactlyOnceWith(0); expect(f.restore).toHaveBeenCalledExactlyOnceWith(f.target);
  f.owner.dispose(); f.target.dispose();
});

it('does not draw after its entered owner leaves while linking', async () => {
  const f = fixture(); let release = (): void => undefined;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const pending = warmComposerFrame(f.composer, f.renderer, () => barrier, () => !f.owner.disposed);
  f.owner.dispose(); release(); await expect(pending).rejects.toThrow('left during shader warm-up'); expect(f.render).not.toHaveBeenCalled(); f.target.dispose();
});

it('restores the target and propagates a composer failure instead of publishing readiness', async () => {
  const f = fixture(); f.render.mockImplementation(() => { throw new Error('depth pass failed'); });
  await expect(warmComposerFrame(f.composer, f.renderer, () => Promise.resolve(), () => true)).rejects.toThrow('depth pass failed');
  expect(f.restore).toHaveBeenCalledExactlyOnceWith(f.target); f.owner.dispose(); f.target.dispose();
});
