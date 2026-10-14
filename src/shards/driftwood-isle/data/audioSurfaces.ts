export const ISLAND_SURFACES = ['sand','wetSand','grass','rock','planks','stone','water'] as const;
export type Surface = typeof ISLAND_SURFACES[number];
