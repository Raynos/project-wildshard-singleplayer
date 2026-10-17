// The Stack's signs on the SDK sign system (@wildshard/sdk/looks/signs; the styles are data/signs.ts rows): the sink the
// world's builders hang signs into, each sign's board going into the kit it is given. The board behind a tube is vertex
// colour, so the neon shader glows the tubes (HDR, into the bloom) while the board stays a dark ink mass.
import type { Vector3 } from 'three';
import type { SignBuilder as SignBuilderView } from '../runtime/signs/signAtlas';
import type { SignStyle } from '../data/signs';
import type { SignPlace as AuthoredSignPlace, SignSink as AuthoredSignSink, SignBoardKit } from '../assets/contracts/signPlacement';

export type SignPlace = AuthoredSignPlace;

/**
 * Where the world's builders hang their signs (world/ctx.ts `Ctx.signs`): the page's KitSigns, or the layout bake's
 * recorder (../generators/layout.ts), whose calls the page replays into its KitSigns in order (world/layoutBake.ts)
 */
export type SignSink = AuthoredSignSink;

/** The page replays sign faces; every dark board is already in its offline kit. */
export class KitSigns implements SignSink {
  constructor(readonly builder: SignBuilderView<SignStyle>) {}
  place(p: SignPlace, kit: SignBoardKit | null): { w: number; h: number } {
    if (kit !== null) throw new Error('Nine sign boards must be baked');
    return this.builder.place(p, null);
  }
  light(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, color: number, gain: number, mode: 1 | 2 = 1, seed = 0): void {
    this.builder.light(c, right, up, w, h, color, gain, mode, seed);
  }
  tube(a: Vector3, b: Vector3, facing: Vector3, width: number, color: number, gain: number, flicker = 0): void {
    this.builder.tube(a, b, facing, width, color, gain, flicker);
  }
}
