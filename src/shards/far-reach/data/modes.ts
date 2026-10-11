import type { ModeRows, UpdraftRow } from '@wildshard/sdk/modes';
import { UPDRAFT } from './layout';

/** The native board wind column's geometry and force; its open boundaries stay platform law. */
export const SKY_UPDRAFT: UpdraftRow = { kind: 'updraft', id: 'far.updraft',
  from: { x: UPDRAFT.x0, y: UPDRAFT.y, z: UPDRAFT.z0 }, to: { x: UPDRAFT.x1, y: UPDRAFT.y1, z: UPDRAFT.z1 },
  width: UPDRAFT.width, margin: 0.5, lift: 12 };
/** Sky's traversal parameters, admitted once with its native player owner. */
export const SKY_MODES: ModeRows = { traverse: [SKY_UPDRAFT] };
