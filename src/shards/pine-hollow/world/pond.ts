/** The authored beaver pool meets the reusable pond's identical tessellation. */
import { pondGrid as grid } from '#engine';
import { POND } from '#engine/world/Heightfield';

export function pondGrid(): ReturnType<typeof grid> { return grid(POND); }
