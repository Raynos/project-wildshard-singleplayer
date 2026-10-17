import type { ModeRows } from '@wildshard/sdk/modes';
import type { UpdraftMode } from '@wildshard/format/modes';
import LAYOUT from './layout.generated.json' with { type: 'json' };

/** The native board wind column's geometry and force; its open boundaries stay platform law. */
export const SKY_UPDRAFT: UpdraftMode = { kind: 'updraft', id: 'far.updraft',
  from: { x: LAYOUT.UPDRAFT.x0, y: LAYOUT.UPDRAFT.y, z: LAYOUT.UPDRAFT.z0 }, to: { x: LAYOUT.UPDRAFT.x1, y: LAYOUT.UPDRAFT.y1, z: LAYOUT.UPDRAFT.z1 },
  width: LAYOUT.UPDRAFT.width, margin: 0.5, lift: 12 };
/** Sky's traversal parameters, admitted once with its native player owner. */
export const SKY_MODES: ModeRows = { traverse: [SKY_UPDRAFT] };
