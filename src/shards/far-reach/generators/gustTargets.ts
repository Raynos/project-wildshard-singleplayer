import { parseWorldTargets } from '@wildshard/format/worldTargets';
import { FAN_GUST, FAN_ID } from './rows/items';
import { VANES } from "./layout";
import { SKY_ACTIONS } from './questGraph';
import STRINGS from '../data/strings.json' with { type: 'json' };

const notes = SKY_ACTIONS.rows.find(row => row.id === 'notes');
if (notes === undefined) throw new Error('Missing declared Sky notes interaction');

/** Build-only vane contacts; the existing fan landing owns the scan in page and simulation. */
export const SKY_GUST_TARGETS = parseWorldTargets({ targets: VANES.map(vane => ({
  id: `far.vane.${vane.id}`, weapon: FAN_ID, at: [vane.x, vane.y + 3.3, vane.z], radius: 0,
  needs: { all: notes.sets, none: [vane.flag] },
  scan: { kind: 'cone', reach: FAN_GUST.reach + 2, halfAngle: FAN_GUST.halfAngle + 0.15, selection: 'all' },
  rules: [{ move: 'far.fan.gust', contact: 0, effects: [{ kind: 'flag', id: vane.flag }, { kind: 'hint', text: STRINGS.vaneTurned }], caught: 'never' }],
})), spots: [] }).targets;
