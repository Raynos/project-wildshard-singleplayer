// kitSet — a world build's named kits (SHARD-PLATFORM M3, ex Nine Dragon's world/ctx.ts): one builder per name, each
// merged into one mesh by the kit conversion (kitConvert `convertKits({ solid: kits, swept: kitxs, alpha: alphaKits })`).
// Builders write into a kit by name; a region's detail is split into cells of the ground plan (`cell`) so three's
// per-object frustum test can drop each, and a kit can carry a draw distance (`far`) the instance culler applies.
//
//   const set = new KitSet(() => new RuledKit(), () => new SweptKit());
//   set.kit(set.cell('well', x, z)).box(…);  set.far('deep', 60);
import type { KitBuilder } from './kitConvert';

/** A world build's named kits: opaque, alpha-cut and swept builders by name, the reflective names and the draw distances. */
export class KitSet<K extends KitBuilder, X extends KitBuilder> {
  /** the opaque kits by name */
  readonly kits = new Map<string, K>();
  /** the alpha-cut kits by name */
  readonly alphaKits = new Map<string, K>();
  /** the swept kits by name, merged with the kit of the same name */
  readonly kitxs = new Map<string, X>();
  /** kits drawn into the wet-ground reflection */
  readonly reflective = new Set<string>();
  /** kits drawn only within a distance (m) of the camera (`far`) */
  readonly farOf = new Map<string, number>();
  private readonly makeKit: () => K;
  private readonly makeSwept: () => X;

  /** `makeKit` makes an opaque or alpha kit, `makeSwept` a swept one */
  constructor(makeKit: () => K, makeSwept: () => X) {
    this.makeKit = makeKit;
    this.makeSwept = makeSwept;
  }

  /** the opaque kit `name` (made on first use); `reflective` adds it to the wet-ground reflection */
  kit(name: string, reflective = false): K {
    let k = this.kits.get(name);
    if (k === undefined) { k = this.makeKit(); this.kits.set(name, k); }
    if (reflective) this.reflective.add(name);
    return k;
  }

  /** the alpha-cut kit `name` (made on first use) */
  alpha(name: string): K {
    let k = this.alphaKits.get(name);
    if (k === undefined) { k = this.makeKit(); this.alphaKits.set(name, k); }
    return k;
  }

  /** the swept kit `name` (made on first use) */
  kitx(name: string): X {
    let k = this.kitxs.get(name);
    if (k === undefined) { k = this.makeSwept(); this.kitxs.set(name, k); }
    return k;
  }

  /**
   * The per-region LOD switch: draw the kit `name` (opaque, alpha or swept of that name) only while the camera is within
   * `metres` of its bounding box. Paired with `cell`, a region's detail is its own kits, so what lies far off costs nothing.
   */
  far(name: string, metres: number): void { this.farOf.set(name, metres); }

  /**
   * A kit name per `size`-metre cell of the ground plan (`<name>#<i>,<k>`): a region's kit split so each cell is its own
   * mesh, which three's per-object frustum test can drop. Each cell is a draw when in view, so cells of 24–40 m for dense
   * detail, not finer.
   */
  cell(name: string, x: number, z: number, size = 32): string { return `${name}#${Math.floor(x / size)},${Math.floor(z / size)}`; }
}
