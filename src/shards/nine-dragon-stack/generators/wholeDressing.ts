/** The world-scene materials that draw through a look graph (material id, graph id), in the catalogue's order. */
export const NINE_MATERIAL_LOOKS: readonly (readonly [string, string])[] = [
  ['kit', 'nine-architecture'], ['kit-cut', 'nine-architecture-cut'], ['facade', 'nine-facade'], ['small', 'nine-facade-small'],
  ['windows', 'nine-windows'], ['lantern', 'nine-lantern'], ['canopy-core', 'nine-canopy-inner'], ['canopy-cards', 'nine-canopy-cards'],
  ['canopy-depth', 'nine-canopy-depth'], ['mist-sheet', 'nine-mist-sheet'], ['steam', 'nine-steam'], ['sky', 'nine-sky'], ['scroll', 'nine-scroll'],
  ['streaks', 'nine-streaks'], ['halo', 'nine-halo'], ['neon', 'nine-neon'], ['neon-board', 'nine-neon-board'], ['neon-tube', 'nine-neon-tube'],
];

/** One dressing node that draws a whole-library shape (the canopy crown and the mist) with its world-scene material. */
export interface NineWholeDressing {
  readonly id: string; readonly model: string; readonly material: string; readonly order: number; readonly name: string;
  /** the whole tile the node needs (drawn only when the bake made it), or null for always */
  readonly when: string | null; readonly culled: boolean;
}
/** The whole shapes the dressing scene draws, and with which material (the scene bake reads these to keep the shapes
 *  drawn through an object-space look at exact float positions). */
export const NINE_WHOLE_DRESSING: readonly NineWholeDressing[] = [
  { id: 'crown-core', model: 'canopy:core', material: 'canopy-core', order: 0, name: 'canopy', when: 'canopy:core', culled: true },
  { id: 'crown-cards', model: 'canopy:cards', material: 'canopy-cards', order: 1, name: 'canopy', when: 'canopy:core', culled: true },
  { id: 'crown-depth', model: 'canopy:cards', material: 'canopy-depth', order: 2, name: 'canopy', when: 'canopy:core', culled: true },
  { id: 'sheets', model: 'mist:sheets', material: 'mist-sheet', order: 2, name: 'sheets', when: 'mist:sheets', culled: true },
  { id: 'steam', model: 'mist:steam', material: 'steam', order: 3, name: 'steam', when: null, culled: false },
];
