// Registers every species exactly as src/entities/AnimalFactory.ts does (eager glob over the folder) without pulling in
// the factory itself (materials, baked textures, the sky). The glob runs when this module loads; `loadSpecies()` makes
// the dependency explicit at the call site and returns the files it registered.
const modules = import.meta.glob(['../src/entities/species/*.ts', '!../src/entities/species/registry.ts', '!../src/entities/species/loft.ts'], { eager: true });

export function loadSpecies(): string[] { return Object.keys(modules); }
