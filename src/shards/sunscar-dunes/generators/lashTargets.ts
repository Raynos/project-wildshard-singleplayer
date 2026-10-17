import { parseWorldTargets } from '@wildshard/format/worldTargets';
import { WHIP_ITEM } from '../data/items';
import STRINGS from '../data/strings.json' with { type: 'json' };
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Immutable contact points share the baked places' coordinates and authored nearest-target order. */
export const SIGNAL_LASH_TARGETS = parseWorldTargets({ targets: baked.spots.crack.map(spot => ({
  id: spot.id, weapon: WHIP_ITEM.id, at: [spot.x, spot.y, spot.z], radius: spot.radius,
  needs: spot.id === 'well.crank' ? { none: ['raised'] } : {},
  scan: { kind: 'ray', selection: 'nearest' },
  rules: spot.id === 'well.crank' ? [
    { move: 'sunscar.whip.crack', contact: 0, effects: [{ kind: 'hint', text: STRINGS.pullHint }], caught: 'always' },
    { move: 'sunscar.whip.double.1', contact: 0, effects: [], caught: 'always' },
    { move: 'sunscar.whip.double.2', contact: 1, effects: [{ kind: 'interaction', id: 'crank' }], caught: 'if-applied' },
  ] : [
    { move: 'sunscar.whip.crack', contact: 0, effects: [{ kind: 'interaction', id: spot.id.replace('brazier.', 'light.') }], caught: 'if-applied' },
    { move: 'sunscar.whip.double.1', contact: 0, effects: [{ kind: 'interaction', id: spot.id.replace('brazier.', 'light.') }], caught: 'if-applied' },
    { move: 'sunscar.whip.double.2', contact: 1, effects: [{ kind: 'interaction', id: spot.id.replace('brazier.', 'light.') }], caught: 'if-applied' },
  ],
})), spots: [] });
