import { defineModel } from '@wildshard/engine/models/model';
import { TemplateLantern } from '../weapons/TemplateLantern';
import { STRINGS } from '../strings';

export const lanternModel = defineModel({ id: '_template/lantern', name: STRINGS.lantern, category: 'gear',
  pipeline: 'code', file: 'src/shards/_template/models/gear.ts', defaults: {}, build: () => new TemplateLantern().model });
