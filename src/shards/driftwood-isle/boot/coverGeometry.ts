import type { BufferGeometry } from 'three';
import { modelGeometry } from '@wildshard/sdk/modelGeometry';
import { FIXED_MODEL_FILES } from '../data/modelFiles';

/** Immutable templates; runtime instance channels are attached only to independent copies. */
const templates = {
  tuft: modelGeometry(FIXED_MODEL_FILES.coverTuft),
  fern: modelGeometry(FIXED_MODEL_FILES.coverFern),
  hibiscus: modelGeometry(FIXED_MODEL_FILES.coverHibiscus),
  daisy: modelGeometry(FIXED_MODEL_FILES.coverDaisy),
  pebble: modelGeometry(FIXED_MODEL_FILES.coverPebble),
  shells: modelGeometry(FIXED_MODEL_FILES.coverShells),
  starfish: modelGeometry(FIXED_MODEL_FILES.coverStarfish),
  bush: modelGeometry(FIXED_MODEL_FILES.coverBush),
  tuftFar: modelGeometry(FIXED_MODEL_FILES.coverTuftFar),
  fernFar: modelGeometry(FIXED_MODEL_FILES.coverFernFar),
  hibiscusFar: modelGeometry(FIXED_MODEL_FILES.coverHibiscusFar),
  daisyFar: modelGeometry(FIXED_MODEL_FILES.coverDaisyFar),
  bushFar: modelGeometry(FIXED_MODEL_FILES.coverBushFar),
};

/** Explicit boot intake, including the same bytes-only path for portable fixtures. */
export async function loadCoverGeometry(bytes?: ReadonlyMap<string, Uint8Array>): Promise<void> {
  await Promise.all([
    templates.tuft.load(bytes?.get(FIXED_MODEL_FILES.coverTuft)),
    templates.fern.load(bytes?.get(FIXED_MODEL_FILES.coverFern)),
    templates.hibiscus.load(bytes?.get(FIXED_MODEL_FILES.coverHibiscus)),
    templates.daisy.load(bytes?.get(FIXED_MODEL_FILES.coverDaisy)),
    templates.pebble.load(bytes?.get(FIXED_MODEL_FILES.coverPebble)),
    templates.shells.load(bytes?.get(FIXED_MODEL_FILES.coverShells)),
    templates.starfish.load(bytes?.get(FIXED_MODEL_FILES.coverStarfish)),
    templates.bush.load(bytes?.get(FIXED_MODEL_FILES.coverBush)),
    templates.tuftFar.load(bytes?.get(FIXED_MODEL_FILES.coverTuftFar)),
    templates.fernFar.load(bytes?.get(FIXED_MODEL_FILES.coverFernFar)),
    templates.hibiscusFar.load(bytes?.get(FIXED_MODEL_FILES.coverHibiscusFar)),
    templates.daisyFar.load(bytes?.get(FIXED_MODEL_FILES.coverDaisyFar)),
    templates.bushFar.load(bytes?.get(FIXED_MODEL_FILES.coverBushFar)),
  ]);
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
