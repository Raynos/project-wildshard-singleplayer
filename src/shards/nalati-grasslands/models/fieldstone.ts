import { defineModel } from '@wildshard/engine/models/model';
import { fieldstoneBaked } from './campProps';
import { painted, paintFieldstone, type FieldstoneParams } from '../world/painted';

/** The tower still paints its rubble live; catalog metadata is shared with the static kurgan bake. */
export const fieldstone = defineModel<FieldstoneParams>({ ...fieldstoneBaked, build: painted(paintFieldstone, { seed: 0x4b62 }) });
