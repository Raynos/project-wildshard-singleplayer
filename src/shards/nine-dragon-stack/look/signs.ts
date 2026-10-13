// The Stack's signs on the SDK sign system (@wildshard/sdk/looks/signs; the styles are data/signs.ts rows): the sink the
// world's builders hang signs into, each sign's board going into the kit it is given. The board behind a tube is vertex
// colour, so the neon shader glows the tubes (HDR, into the bloom) while the board stays a dark ink mass.
import type { Vector3 } from 'three';
import { signBoardBox, signSize as boardSize, type SignBoardSink, type SignBuilder as SignBuilderView } from '../runtime/signs/signAtlas';
import { SIGN_STYLES, type SignStyle } from '../data/signs';
import type { SignPlace as AuthoredSignPlace, SignSink as AuthoredSignSink, SignBoardKit } from '../assets/contracts/signPlacement';

export type SignPlace = AuthoredSignPlace;

/**
 * Where the world's builders hang their signs (world/ctx.ts `Ctx.signs`): the page's KitSigns, or the layout bake's
 * recorder (../generators/layout.ts), whose calls the page replays into its KitSigns in order (world/layoutBake.ts)
 */
export type SignSink = AuthoredSignSink;

/** a sign's board into a kit (a dark box) */
const kitBoard = (kit: SignBoardKit): SignBoardSink => (b) => { kit.boxAxes(b.c, b.right, b.up, b.normal, b.hx, b.hy, b.hz, { wash: 0x24262c, line: 1 }); };

/** a lightbox / plaque / etched sign's face size (m): every style but calligraphy tubes (`NeonText.size`) */
export const signSize = (p: SignPlace): { w: number; h: number } => boardSize(SIGN_STYLES[p.spec.style], p);

/** a sign's board (a dark box behind its face) into `kit`: what `KitSigns.place` adds to the kit it is given */
export function signBoard(kit: SignBoardKit, p: SignPlace, w: number, h: number): void {
  kitBoard(kit)(signBoardBox(SIGN_STYLES[p.spec.style], p, w, h));
}

/** the page's sign sink: the SDK builder, a sign's board into the kit it is given */
export class KitSigns implements SignSink {
  constructor(readonly builder: SignBuilderView<SignStyle>) {}
  place(p: SignPlace, kit: SignBoardKit | null): { w: number; h: number } { return this.builder.place(p, kit === null ? null : kitBoard(kit)); }
  light(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, color: number, gain: number, mode: 1 | 2 = 1, seed = 0): void {
    this.builder.light(c, right, up, w, h, color, gain, mode, seed);
  }
  tube(a: Vector3, b: Vector3, facing: Vector3, width: number, color: number, gain: number, flicker = 0): void {
    this.builder.tube(a, b, facing, width, color, gain, flicker);
  }
}
