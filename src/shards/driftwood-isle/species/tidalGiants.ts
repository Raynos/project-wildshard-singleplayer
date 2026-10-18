import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { creatureBody } from './bodies';

/** Pose programs are lent from the verified product, never imported from build sources. */
export function tidalGiantsLooks(bellbackClips: unknown, colossusClips: unknown): SpeciesLook[] {
const BELLBACK_LOOK: SpeciesLook = {
  id: 'driftwood.look.bellback', species: 'creature.bellback', kind: 'bellback', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'bellback.v1', clips: [], sockets: ['body', 'head', 'bell', 'clapper'] },
  build: v => creatureBody('bellback', v.id), animate: numericCreaturePose(bellbackClips),
};
const TIDE_ROOT_COLOSSUS_LOOK: SpeciesLook = {
  id: 'driftwood.look.tide-root-colossus', species: 'creature.tide-root-colossus', kind: 'tideRootColossus', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'tide-root-colossus.v1', clips: [], sockets: ['body', 'head', 'heart', 'root0', 'root1', 'root2', 'root3'] },
  build: v => creatureBody('tideRootColossus', v.id), animate: numericCreaturePose(colossusClips),
};

return [BELLBACK_LOOK, TIDE_ROOT_COLOSSUS_LOOK];
}
