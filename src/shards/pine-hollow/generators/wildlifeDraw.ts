import draw from '../data/wildlifeDraw.json' with { type: 'json' };
import birds from '../data/ambientBirds.generated.json' with { type: 'json' };

/** The original authored rest ranges, pose lanes and Explorer cards, carried by the product. */
export const WILDLIFE_DRAW = { ...draw, assets: { name: birds.name, channels: birds.channels, ranges: birds.ranges } };
