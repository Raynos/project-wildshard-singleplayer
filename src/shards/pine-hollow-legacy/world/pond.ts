/** The authored beaver pool meets the reusable pond's identical tessellation. */
import { POND } from '@wildshard/engine/world/Heightfield';
import { pondGrid as grid } from '@wildshard/engine/world/pondGrid';

export function pondGrid(): ReturnType<typeof grid> { return grid(POND); }
