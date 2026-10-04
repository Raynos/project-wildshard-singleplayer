// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BoxGeometry, MeshBasicMaterial, Texture } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { enterOwner } from '../../src/engine/app/ownership';
import { UploadOwnership } from '../../src/engine/render/uploadOwnership';

it('frees uploaded orphan resources while preserving named acquisitions and already-disposed resources', () => {
  const scope = new Scope('test'); enterOwner(scope);
  const uploads = new UploadOwnership(scope, app.assets);
  const orphan = new BoxGeometry(), shared = new Texture(), gone = new MeshBasicMaterial();
  const orphanDispose = vi.fn<() => void>(), sharedDispose = vi.fn<() => void>(), goneDispose = vi.fn<() => void>();
  // These stand in for the renderer registrations: disposal removes the live GPU allocation listener.
  const uploaded = (resource: BoxGeometry | MeshBasicMaterial | Texture, dispose: () => void): void => {
    const onDispose = (): void => { dispose(); resource.removeEventListener('dispose', onDispose); };
    resource.addEventListener('dispose', onDispose); uploads.observe(resource);
  };
  uploaded(orphan, orphanDispose); uploaded(shared, sharedDispose); uploaded(gone, goneDispose);
  gone.dispose();
  app.assets.register(`test:upload:${shared.uuid}`, shared, { retain: true });
  scope.dispose(); enterOwner(null);
  expect(orphanDispose).toHaveBeenCalledOnce(); expect(goneDispose).toHaveBeenCalledOnce(); expect(sharedDispose).not.toHaveBeenCalled();
  expect(Object.values(scope.census).every((n) => n === 0)).toBe(true);
});
