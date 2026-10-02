/** Every coordinate in Sky Reach. Islands float over the cloud sea; each walkable top sits at its own `y`. */
export const DECK = 30;
/** The high islands: the step above the windmill and the storm crown. */
export const HIGH = 44;
/** How far a hover deck's collider starts clear of an island rim (Jake: a hover deck never touches a rim). */
export const HOVER_GAP = 0.6;
/** An island: centre, rim radius (the 12-gon's corner radius), deck height and the depth of its rock keel. */
export interface Isle { readonly id: string; readonly x: number; readonly z: number; readonly r: number; readonly y: number; readonly keel: number }
export const SUNREST: Isle = { id: 'sunrest', x: 0, z: 0, r: 17, y: DECK, keel: 22 };
export const WINDMILL: Isle = { id: 'windmill', x: 0, z: -64, r: 16, y: DECK, keel: 26 };
export const GROVE: Isle = { id: 'grove', x: -56, z: -4, r: 12, y: DECK, keel: 16 };
export const ROOST: Isle = { id: 'roost', x: 62, z: -4, r: 13, y: DECK, keel: 18 };
export const KEEPER: Isle = { id: 'keeper', x: -56, z: -66, r: 12, y: DECK, keel: 18 };
export const RUIN: Isle = { id: 'ruin', x: 62, z: -66, r: 13, y: DECK, keel: 20 };
export const STEP: Isle = { id: 'step', x: 0, z: -124, r: 13, y: HIGH, keel: 20 };
export const CROWN: Isle = { id: 'crown', x: 0, z: -190, r: 20, y: HIGH, keel: 34 };
export const ISLES: readonly Isle[] = [SUNREST, WINDMILL, GROVE, ROOST, KEEPER, RUIN, STEP, CROWN];
/** The apothem of an island's 12-gon top: where the rim edge is nearest the centre. */
export const apothem = (isle: Isle): number => isle.r * Math.cos(Math.PI / 12);

/** A straight bridge along one axis between two islands at deck height `y`. Rope bridges carry walkers; hover ones only a board rider. */
export interface Span { readonly id: string; readonly kind: 'rope' | 'hover'; readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number; readonly y: number; readonly width: number }
/** A rope span overlaps both rims by a metre; a hover span starts `HOVER_GAP` clear of each rim. */
function along(id: string, kind: Span['kind'], a: Isle, b: Isle, width: number): Span {
  const inset = kind === 'rope' ? -1 : HOVER_GAP;
  if (a.z === b.z) { const s = Math.sign(b.x - a.x); return { id, kind, x0: a.x + s * (apothem(a) + inset), z0: a.z, x1: b.x - s * (apothem(b) + inset), z1: b.z, y: a.y, width }; }
  const s = Math.sign(b.z - a.z); return { id, kind, x0: a.x, z0: a.z + s * (apothem(a) + inset), x1: b.x, z1: b.z - s * (apothem(b) + inset), y: a.y, width };
}
export const HOVER_BRIDGE: Span = along('far.hover.roost', 'hover', { ...SUNREST, z: ROOST.z }, ROOST, 3);
export const SPANS: readonly Span[] = [
  along('far.rope.windmill', 'rope', SUNREST, WINDMILL, 2.6),
  along('far.rope.grove', 'rope', { ...SUNREST, z: GROVE.z }, GROVE, 2.4),
  HOVER_BRIDGE,
  along('far.hover.keeper', 'hover', GROVE, KEEPER, 3),
  along('far.rope.ruin', 'rope', ROOST, RUIN, 2.4),
];
/** The updraft: a board-only rising wind ramp from the windmill isle's north rim up to the step. */
export const UPDRAFT = { x: 0, z0: WINDMILL.z - apothem(WINDMILL) - HOVER_GAP, y0: DECK, z1: STEP.z + apothem(STEP) + HOVER_GAP, y1: HIGH, width: 4 } as const;
/** The fallen bridge: it hangs from the step's north rim until its winch raises it to the storm crown. */
export const FALLEN_BRIDGE: Span = { id: 'far.bridge.crown', kind: 'rope', x0: 0, z0: STEP.z - apothem(STEP) + 0.6, x1: 0, z1: CROWN.z + apothem(CROWN) - 1, y: HIGH, width: 2.6 };
export const WINCH = { x: 3.2, z: STEP.z - apothem(STEP) + 2.2, y: HIGH };
export const MILL = { x: 2, z: WINDMILL.z - 3 };
/** The bridge-keeper's notes (quest step 1), on the broken-bridge isle. */
export const NOTES = { x: KEEPER.x - 3, z: KEEPER.z - 2, y: DECK };
/** The three wind vanes (quest step 3): GUST each one to set it turning. */
export const VANES: readonly { readonly id: string; readonly x: number; readonly z: number; readonly y: number }[] = [
  { id: 'grove', x: GROVE.x + 4, z: GROVE.z - 5, y: DECK }, { id: 'keeper', x: KEEPER.x + 4, z: KEEPER.z + 4, y: DECK }, { id: 'ruin', x: RUIN.x - 3, z: RUIN.z - 4, y: DECK },
];
/** The storm crown's last platform: the Roc grounds itself here in its third phase. */
export const DAIS = { x: CROWN.x, z: CROWN.z - 6, r: 5, h: 0.3 };

export const SPAWN = { x: 0, z: 7, yaw: 0 };
/** Flying homes: centre, circle radius and altitude (world metres). The roost's three rays are quest step 2. */
export interface Home { readonly x: number; readonly z: number; readonly r: number; readonly y: number }
/** The free ray glides a wide circle right of the windmill isle, past its notice range from the spawn: it shows itself first (the mockup) and dives only once you cross the bridge (review item 9). */
export const RAY_HOMES: readonly Home[] = [{ x: 24, z: -64, r: 14, y: DECK + 9 }];
export const ROOST_RAYS: readonly Home[] = [0, 1, 2].map((i) => ({ x: ROOST.x, z: ROOST.z, r: 12 + i * 3, y: DECK + 10 + i * 2 }));
export const WISP_HOMES: readonly Home[] = [{ x: KEEPER.x, z: KEEPER.z, r: 7, y: DECK + 3 }, { x: STEP.x, z: STEP.z, r: 7, y: HIGH + 3 }, { x: RUIN.x, z: RUIN.z, r: 8, y: DECK + 3 }];
/** Sky goats graze where they spawn, inside their island's rim. */
export const GOATS: readonly { readonly isle: Isle; readonly dx: number; readonly dz: number }[] = [
  { isle: WINDMILL, dx: -6, dz: 4 }, { isle: WINDMILL, dx: 7, dz: -2 }, { isle: RUIN, dx: 3, dz: 4 }, { isle: RUIN, dx: -5, dz: -1 }, { isle: GROVE, dx: 2, dz: 3 },
];
/** The Storm Roc's perch over the crown. */
export const ROC = { x: CROWN.x, z: CROWN.z, r: 16, y: HIGH + 16 } as const;
/** Pine positions per island, as offsets from its centre, with a scale. */
export const PINES: Readonly<Record<string, readonly (readonly [number, number, number])[]>> = {
  sunrest: [[-11, -6, 1], [-9, 6, 0.8], [11, 7, 0.9], [12, -3, 1.1], [-4, 12, 0.7]],
  windmill: [[-10, 2, 1], [-7, -8, 0.8], [9, 6, 0.9], [-3, 9, 0.75]],
  roost: [[-4, -7, 0.9], [5, 6, 1.1], [7, -4, 0.8]],
  grove: [[-5, -4, 1.2], [-2, 6, 1], [4, 6, 0.9], [6, 1, 0.8], [-7, 3, 0.7]],
  keeper: [[5, -5, 0.9], [-6, 5, 0.8]],
  ruin: [[6, 6, 1], [-7, 6, 0.8], [8, -5, 0.7]],
  step: [[-6, 5, 0.8], [7, 3, 0.9]],
  crown: [[-13, 6, 1.1], [13, 7, 1], [-12, -7, 0.9], [14, -6, 0.8]],
};
