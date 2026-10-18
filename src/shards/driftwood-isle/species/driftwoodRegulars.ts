import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { creatureBody } from './bodies';

function look(kind: string, clips: unknown): SpeciesLook {
  return { id: `driftwood.look.${kind}`, species: `creature.${kind}`, kind,
    rigContract: { skeleton: `${kind}.v1`, clips: [], sockets: ['body', 'head'] },
    fur: NO_FUR, rig: 'custom', build: v => creatureBody(kind, v.id), animate: numericCreaturePose(clips) };
}
export function driftwoodRegularLooks(puffer: unknown, conch: unknown, mantis: unknown): SpeciesLook[] {
  return [look('brine-puffer', puffer), look('conch-duelist', conch), look('splinter-mantis', mantis)];
}
