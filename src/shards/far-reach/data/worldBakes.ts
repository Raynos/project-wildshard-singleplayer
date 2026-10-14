import type { BakedPiece } from './files';
import winchHouse from './winchHouse.json' with { type: 'json' };
import roost from './roost.json' with { type: 'json' };
import docks from './docks.json' with { type: 'json' };
import crown from './crown.json' with { type: 'json' };
import mill from './mill.json' with { type: 'json' };
import bookStand from './bookStand.json' with { type: 'json' };
import knolls from './knolls.json' with { type: 'json' };
import geometries from './geometries.json' with { type: 'json' };
import isletRig from './isletRig.json' with { type: 'json' };
import dressing from './dressing.json' with { type: 'json' };

/** Authored static kind, pose, material and collider rows, in their original preload order. */
export const WORLD_BAKES = { 'winch-house': winchHouse, roost, docks, crown, mill: { ...mill, kinds: mill.kinds.map(kind => kind.name.startsWith('cloth-') ? Object.assign(structuredClone(kind), { look: 'mill-canvas' }) : kind) }, 'book-stand': bookStand,
  knolls, geometries, 'islet-rig': isletRig, dressing } as const satisfies Readonly<Record<BakedPiece, unknown>>;
