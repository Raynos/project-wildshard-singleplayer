import { STRINGS } from './strings';
import { FAN_ROW } from './equipment';
import { SKY_RUNTIME_BOOT } from './runtimeBoot';
import { SKY_PAGE_PROGRAM } from './population';
import { ROC_ID } from './rocFight';
import { FLAGS } from '../quest/flags';

/** Discovery, boot and population facts; the native plugin supplies only its admitted source. */
export const SKY_RUNTIME_ROWS = { expose: 'farReach', strings: STRINGS, weapon: FAN_ROW, encounters: { id: ROC_ID, displayName: STRINGS.roc },
  complete: FLAGS.complete, boot: SKY_RUNTIME_BOOT, ...SKY_PAGE_PROGRAM };
