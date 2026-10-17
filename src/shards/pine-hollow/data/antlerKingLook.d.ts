type Triple = readonly [number, number, number];
type Pair = readonly [number, number];
interface MaterialRows {
  readonly color: number; readonly roughness: number; readonly metalness: number; readonly fog?: boolean;
}
/** Structural types for authored look JSON; no authored values or runtime code. */
export interface KingLookRows {
  readonly KING_COAT: {
    readonly id: string; readonly label: string; readonly weight: number; readonly hp: number;
    readonly rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    readonly scale: Pair;
    readonly tint: Readonly<Record<string, Triple>>;
    readonly traits: { readonly antlers: number; readonly antlerScale: number; readonly selfLight: number };
  };
  readonly KING_DRESS: {
    readonly ribR: number; readonly ribAt: Triple; readonly ribHit: number;
    readonly open: { readonly breathe: Pair; readonly ribs: Triple; readonly core: number; readonly coreGlow: Pair; readonly ribGlow: Pair };
    readonly frameMat: MaterialRows;
    readonly glowMat: MaterialRows;
    readonly amber: Triple;
    readonly glow: { readonly glass: number; readonly ribs: number; readonly core: number };
  };
  readonly KING_OWN_RIG: { readonly dims: {
    readonly bodyY: number; readonly bodyHalfLen: number; readonly bodyRadius: number; readonly headRadius: number;
    readonly legLen: number; readonly halfWidth: number; readonly feet: readonly Pair[];
    readonly bodyAt: Triple; readonly bodyPitch: number; readonly headAt: Triple;
    readonly fore: { readonly bone: string; readonly at: Triple; readonly halfLen: number; readonly radius: number };
  } };
}
