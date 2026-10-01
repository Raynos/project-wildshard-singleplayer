// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BoxGeometry, MeshBasicMaterial, Texture } from 'three';
import { app } from '#engine/app/runtime';
import { LegacyCapture, enterScope } from '#engine/app/legacyCapture';
import { UploadOwnership } from '#engine/render/uploadOwnership';

it('frees uploaded orphan resources while preserving named acquisitions and already-disposed resources', () => {
  const scope = new LegacyCapture('test'); enterScope(scope);
  const uploads = new UploadOwnership(scope.resources, app.assets);
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
  scope.resources.dispose(); enterScope(null);
  expect(orphanDispose).toHaveBeenCalledOnce(); expect(goneDispose).toHaveBeenCalledOnce(); expect(sharedDispose).not.toHaveBeenCalled();
  expect(Object.values(scope.resources.census).every((n) => n === 0)).toBe(true);
});
