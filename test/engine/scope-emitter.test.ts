import { describe, expect, it, vi } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { Scope } from '../../src/engine/app/scope';

describe('scoped emitter events', () => {
  it('forgets a delivered renderer disposal event and invokes it exactly once', () => {
    const scope = new Scope('renderer'), material = new MeshBasicMaterial(), released = vi.fn<() => void>();
    scope.listenOnceEmitter(material, 'dispose', released);
    expect(scope.census.listeners).toBe(1);
    material.dispose(); material.dispose();
    expect(released).toHaveBeenCalledOnce();
    expect(scope.census.listeners).toBe(0);
    scope.dispose();
    expect(released).toHaveBeenCalledOnce();
  });

  it('removes pending emitter callbacks on owner disposal and rejects late registration', () => {
    const scope = new Scope('renderer'), material = new MeshBasicMaterial(), released = vi.fn<() => void>();
    scope.listenOnceEmitter(material, 'dispose', released);
    scope.dispose();
    material.dispose();
    scope.listenOnceEmitter(material, 'dispose', released);
    material.dispose();
    expect(released).not.toHaveBeenCalled();
    expect(scope.census.listeners).toBe(0);
  });
});
