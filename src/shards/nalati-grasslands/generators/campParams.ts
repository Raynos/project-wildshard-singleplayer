export type FieldstoneLook = 'kurgan' | 'rubble';

export interface FieldstoneParams {
  /** radius, metres */
  readonly s: number;
  /** height over width */
  readonly squash: number;
  /** how lumpy */
  readonly rough: number;
  /** how far its centre sits over the ground, × its radius (negative: sunk) */
  readonly lift: number;
  /** its stone and lichen */
  readonly look: FieldstoneLook;
}


export interface Board {
  readonly text: string;
  /** the way the arrow points (world yaw of the direction, atan2(dx, dz)) */
  readonly dir: number;
}

export interface SignpostParams { readonly boards: readonly Board[] }


interface Box { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }



export interface HitchingRailParams { readonly length: number; readonly height: number }

export interface CorralParams { readonly r: number; readonly posts: number }

export interface SpanParams {
  /** the far end, relative to the placement (the near end) */
  readonly dx: number;
  readonly dz: number;
}

export interface RugParams { readonly w: number; readonly h: number; readonly pal: number }

export interface PalsParams { readonly pals: readonly number[] }

export interface BarrelParams { readonly s: number }

export interface RugLineParams extends SpanParams { readonly pals: readonly number[] }


// Static world models share this catalog and the existing places bake.
export interface CragLedgeParams {
  /** the slab's width across the slope and its depth out of it (m) */
  readonly w: number;
  readonly d: number;
  /** snow settles on its top above this height */
  readonly snowLine: number;
}


export interface LeopardCaveParams {
  /** snow settles on its tops above this height */
  readonly snowLine: number;
}


export interface KurganEntranceParams {
  /** the ground at the mound's foot on the door axis (where the steps come down to) */
  readonly footY: number;
}


export interface KurganKerbParams {
  /** radius, metres */
  readonly s: number;
  /** lying flat on its side (robbed and toppled) */
  readonly fallen: boolean;
}


export interface LogParams {
  /** its ends, relative to the placement (normally the near end: 0, 0; see `logEnds`) */
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly r: number;
  /** bleached driftwood on a gravel bar (else a fallen spruce, mossed) */
  readonly drift: boolean;
}



export interface StumpParams { readonly s: number }

export interface OvooParams { readonly s: number }

export interface ClutterParams { readonly kind: number }


export interface FenceParams {
  /** the run's points, relative to the placement: (x, z), the first (0, 0) */
  readonly pts: readonly (readonly [number, number])[];
  /** post height (m) and spacing along the run */
  readonly h: number;
  readonly spacing: number;
}


export type RockTint = 'granite' | 'warm' | 'cool';


export interface GraniteOutcropParams {
  /** the block: width (along the contour), height, depth; how rough its surface */
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly rough: number;
  /** its tip into the slope (radians about its own x / z) */
  readonly pitch: number;
  readonly roll: number;
  /** its tint; absent: drawn from the stream after the block's shape (`draw`: of two, granite / warm, or of three) */
  readonly tint?: RockTint;
  readonly draw?: 2 | 3;
  /** how much lichen on its tops */
  readonly lichen: number;
  /** it collides (as the hull of what it draws) */
  readonly solid: boolean;
}


export type BoulderLook = 'lean' | 'channel' | 'bank' | 'bed' | 'streambank';


export interface RoundedBoulderParams {
  /** radius, metres */
  readonly r: number;
  readonly look: BoulderLook;
  /** its tint; absent: drawn from the stream after its shape, cool with these odds, else granite */
  readonly tint?: RockTint;
  readonly coolOdds?: number;
  readonly solid: boolean;
}


export interface StoneStepParams {
  /** the tread's width across the flight and its depth along it, the block's height (m) */
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** its shape's seed (the stair's step number) */
  readonly seed: number;
}


export interface FirewoodParams {
  /** a turn of this copy off its pile's line (a pile is two stacks side by side) */
  readonly dy: number;
  /** the pile's one box (world space), carried by the first stack of a pile */
  readonly pile?: Box;
}


export interface ChurnParams {
  /** its box's half-width and height */
  readonly hw: number;
  readonly h: number;
}


export interface YurtParams {
  /** wall radius (m), 2.4–3.6 */
  readonly r: number;
  /** a stove pipe out of the crown, smoking */
  readonly flue: boolean;
  /** 0..2 — band colourway */
  readonly palette: number;
  /** an older, greyer felt */
  readonly old: boolean;
  readonly base: 'lattice' | 'reed' | 'felt';
  /** a red (palette 0) or orange pennant on a short pole at the crown */
  readonly pennant: boolean;
}


export interface KunesBridgeParams {
  /** the deck's width (m) */
  readonly width: number;
  /** the river corridor's span the deck stays level over (m) */
  readonly span: number;
}
export interface CatalogueParams {
  readonly ribbonPole: object;
  readonly eaglePerch: object;
  readonly stove: object;
  readonly campBench: object;
  readonly rugRack: PalsParams;
  readonly feltRug: RugParams;
  readonly cart: object;
  readonly barrel: BarrelParams;
  readonly hitchingRail: HitchingRailParams;
  readonly waterTrough: object;
  readonly saddleRack: object;
  readonly corral: CorralParams;
  readonly hayPile: object;
  readonly feedTrough: object;
  readonly rugLine: RugLineParams;
  readonly choppingBlock: object;
  readonly milkCans: object;
  readonly tetherLine: SpanParams;
  readonly kurtBoard: object;
  readonly ribbonPost: object;
  readonly eagleRock: object;
  readonly windCairn: object;
  readonly cragLedge: CragLedgeParams;
  readonly leopardCave: LeopardCaveParams;
  readonly kurganEntrance: KurganEntranceParams;
  readonly kurganKerb: KurganKerbParams;
  readonly fieldstoneBaked: FieldstoneParams;
  readonly fallenLog: LogParams;
  readonly stump: StumpParams;
  readonly ovoo: OvooParams;
  readonly viewpointPole: object;
  readonly skyGateway: object;
  readonly campClutter: ClutterParams;
  readonly fence: FenceParams;
  readonly graniteOutcrop: GraniteOutcropParams;
  readonly roundedBoulder: RoundedBoulderParams;
  readonly kokparGoal: object;
  readonly kokparPost: object;
  readonly stoneStep: StoneStepParams;
  readonly signpostBaked: SignpostParams;
  readonly kazan: object;
  readonly chest: object;
  readonly firewood: FirewoodParams;
  readonly kumisChurn: ChurnParams;
  readonly groundSaddle: object;
  readonly perchedEagle: object;
  readonly watchtower: object;
  readonly saddledHorse: object;
  readonly kokparRider: object;
  readonly yurt: YurtParams;
  readonly kunesBridge: KunesBridgeParams;
  readonly herdHorse: object;
  readonly snowLotus: object;
}
