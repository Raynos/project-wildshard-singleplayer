import { DoubleSide, Scene, ShaderMaterial } from 'three';
import { expect, it } from 'vitest';
import { Game } from '../src/engine/core/Game';

it('creates an owned height override without borrowing any scene material constructor', () => {
  const scene = new Scene();
  expect(scene.children).toHaveLength(0);
  const first = Game.prototype.captureHeightMaterial(), second = Game.prototype.captureHeightMaterial();
  try {
    expect(first).toBeInstanceOf(ShaderMaterial);
    expect(first).not.toBe(second);
    expect(first.side).toBe(DoubleSide); expect(first.toneMapped).toBe(false);
    expect(first.depthWrite).toBe(true); expect(first.transparent).toBe(false);
    expect(first.vertexShader).toContain('w = modelMatrix * p');
    expect(first.vertexShader).toContain('p = instanceMatrix * p');
    expect(first.fragmentShader).toContain('65535.0');
    expect(first.fragmentShader).toContain('1.0, 1.0)');
    expect(scene.children).toHaveLength(0);
  } finally { first.dispose(); second.dispose(); }
});
