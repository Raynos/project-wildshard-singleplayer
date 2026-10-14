import { STRINGS } from './strings';
import { WHIP_ROW } from './equipment';
import { SIGNAL_RUNTIME_BOOT } from './runtimeBoot';
import { SIGNAL_PAGE_PROGRAM } from './population';

/** Discovery, boot and population facts; the native plugin supplies only its admitted source. */
export const SIGNAL_RUNTIME_ROWS = { expose: 'sunscar', strings: STRINGS, weapon: WHIP_ROW, encounters: [{ id: 'sunscar.matriarch', displayName: STRINGS.matriarch }],
  complete: 'sunscar.complete', boot: SIGNAL_RUNTIME_BOOT, ...SIGNAL_PAGE_PROGRAM };
