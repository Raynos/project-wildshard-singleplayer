/**
 * The saddled horse, standing (E306 / E315 M3): the Hunyuan3D-2 saddled horse (`horse-saddled.glb`,
 * scripts/img2mesh/props/nalati.json) as a still prop — the spectators' horses standing round the kokpar field's rail
 * (src/shards/nalati-grasslands/world/Bowl.ts). The ridden, rigged horse is the creature (src/engine/entities/, M5); this is the same file
 * standing still, instanced with its place's other generated models when it lands. Walk-through.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { generated } from '../world/painted';

export const saddledHorse = defineModel<object>({
  id: 'nalati-grasslands/saddled-horse', name: 'Saddled horse (standing)', category: 'props', pipeline: 'hunyuan',
  file: 'src/shards/nalati-grasslands/models/saddledHorse.ts', surface: 'flesh',
  defaults: {},
  build: generated({ id: 'nalati-grasslands/saddled-horse', name: 'horse-saddled', look: { rim: 0.8, bands: 0.85 } }),
});
