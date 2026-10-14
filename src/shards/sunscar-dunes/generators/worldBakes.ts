import rocks from '../data/rocks.json' with { type: 'json' };
import dressing from '../data/dressing.json' with { type: 'json' };
import tower from '../data/tower.json' with { type: 'json' };
import caravan from '../data/caravan.json' with { type: 'json' };
import well from '../data/well.json' with { type: 'json' };
import lash from '../data/lash.json' with { type: 'json' };
import braziers from '../data/braziers.json' with { type: 'json' };

/** The complete existing mesh-world declaration, authored without runtime imports. */
export function worldBakes(): { rocks: typeof rocks; dressing: typeof dressing; tower: typeof tower; caravan: typeof caravan; well: typeof well; lash: typeof lash; braziers: typeof braziers } { return { rocks, dressing, tower, caravan, well, lash, braziers }; }
