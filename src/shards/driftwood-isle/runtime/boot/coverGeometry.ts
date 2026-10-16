import { fixedGeometryHandle } from './modelGeometry';
import type { BufferGeometry } from 'three';
import { createOwnedGeometryBatch } from '@wildshard/engine/models/ownedGeometry';

const preload = createOwnedGeometryBatch();
const modelGeometry = (slot: string, channels?: Readonly<Record<string, string>>) => fixedGeometryHandle(slot, channels, preload);

/** Immutable templates; runtime instance channels are attached only to independent copies. */
const templates = {
  tuft: modelGeometry('coverTuft'),
  fern: modelGeometry('coverFern'),
  hibiscus: modelGeometry('coverHibiscus'),
  daisy: modelGeometry('coverDaisy'),
  pebble: modelGeometry('coverPebble'),
  shells: modelGeometry('coverShells'),
  starfish: modelGeometry('coverStarfish'),
  bush: modelGeometry('coverBush'),
  tuftFar: modelGeometry('coverTuftFar'),
  fernFar: modelGeometry('coverFernFar'),
  hibiscusFar: modelGeometry('coverHibiscusFar'),
  daisyFar: modelGeometry('coverDaisyFar'),
  bushFar: modelGeometry('coverBushFar'),
};

/** Explicit boot intake, including the same bytes-only path for portable fixtures. */
export async function loadCoverGeometry(bytes: ReadonlyMap<string, Uint8Array | BufferGeometry>): Promise<void> {
  await preload.load(bytes);
}

/** Keep the near/far double-buffer attributes independent of the immutable source geometry. */
export function copyCoverGeometry(): Record<keyof typeof templates, BufferGeometry> {
  return {
    tuft: templates.tuft.copy(),
    fern: templates.fern.copy(),
    hibiscus: templates.hibiscus.copy(),
    daisy: templates.daisy.copy(),
    pebble: templates.pebble.copy(),
    shells: templates.shells.copy(),
    starfish: templates.starfish.copy(),
    bush: templates.bush.copy(),
    tuftFar: templates.tuftFar.copy(),
    fernFar: templates.fernFar.copy(),
    hibiscusFar: templates.hibiscusFar.copy(),
    daisyFar: templates.daisyFar.copy(),
    bushFar: templates.bushFar.copy(),
  };
}
