import { defineModel } from '#engine';
import { Mesh, MeshStandardMaterial } from 'three';
import { buildFan } from '../weapons/WarFan';
import { mantaGeometry } from '../species/manta';
import { STRINGS } from '../strings';

export const fanModel = defineModel({ id: 'far-reach/fan', name: STRINGS.fan, category: 'gear',
  pipeline: 'code', file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => buildFan() });
export const mantaModel = defineModel({ id: 'far-reach/manta', name: STRINGS.manta, category: 'gear',
  pipeline: 'code', file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => new Mesh(mantaGeometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true })) });
