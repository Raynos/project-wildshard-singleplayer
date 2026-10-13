import type { ModeRows } from '@wildshard/sdk/modes';
import spots from './spotsRows.json' with { type: 'json' };

/** The authored cable floors (data/spotsRows.json) and shipping scalar parameters, admitted by the SDK mode schema. */
export const DRIFTWOOD_MODES: ModeRows = { traverse: [{ kind: 'zipline', id: 'driftwood.zipline',
  top: spots.zipline.top, bottom: spots.zipline.bottom, sag: spots.zipline.sag,
  hang: 2.9, gravity: 9.8, drag: 0.012, maxSpeed: 16 }] };
