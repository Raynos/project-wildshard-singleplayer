// signModel — a sign model over the sign system (SHARD-PLATFORM M3, ex Nine Dragon's models/signs.ts): one model, its
// variants the sign styles, a copy's params its words, colours and size. `signParts` builds one sign alone, centred on the
// origin and facing +z (the Model Explorer's specimen): a calligraphy style through the SDF neon (./neonText: its board
// and its tubes), every other style as a quad over the sign atlas (./signAtlas). `registerSignCopies` registers every
// sign a shard's builder hung where it is drawn — the atlas ones on the shard's `signs` mesh, the calligraphy on the neon
// boards — one `place` each, so a sign costs no draw of its own; each copy's world box is its face and its board's depth.
import { Box3, type Material, type Object3D, Vector3 } from 'three';
import type { ModelContext, ModelDef, ModelPart, Placement } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import type { NeonText } from './neonText';
import { type PlacedSign, type SignAtlas, SignBuilder } from './signAtlas';

/** A sign copy's params: its style, words, colours, size, faces, board and gain. */
export interface SignModelParams<S extends string = string> {
  readonly style: S;
  readonly text: string;
  /** mono styles: the neon / lightbox tint; colour styles: the characters' colour */
  readonly color: string;
  readonly vertical: boolean;
  /** colour styles: the ground (paper, lacquer) */
  readonly ink?: string;
  /** character height, metres */
  readonly size: number;
  /** both faces (a blade sign hanging out from a wall) */
  readonly blade: boolean;
  readonly board?: number;
  readonly gain?: number;
}

/** A sign model's variant as data: its id, its label and its params (words the shard hangs, so their atlas cells are drawn). */
export interface SignVariantRow<S extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly params: Partial<SignModelParams<S>>;
}

/** The sign model as data: its geometry key prefix, the calligraphy styles and their gain scale, the styles that run
 *  sideways, the copies' board depths and standoff, the variant a style is shown as, and the two pieces' ids. */
export interface SignModelRow {
  readonly key: string;
  /** the styles drawn as SDF calligraphy when the look has it */
  readonly calligraphyStyles: readonly string[];
  /** a calligraphy copy's gain is gain / calligraphyGain × tubeGain (its default gain draws the tubes at tubeGain) */
  readonly calligraphyGain: number;
  readonly tubeGain: number;
  /** styles whose words run along y (the blade's etch): their face's up is +x */
  readonly sideways: readonly string[];
  readonly neonDepth: number;
  readonly bladeDepth: number;
  readonly depth: number;
  /** how far an atlas sign's board stands off its face */
  readonly standoff: number;
  /** the variant a style is shown as (a style with no entry: the variant of its own name) */
  readonly variantOf: Readonly<Record<string, string>>;
  readonly pieces: { readonly atlas: string; readonly neon: string };
}

/** What the sign model draws with: the SDF calligraphy (null: calligraphy styles go to the atlas) and the sign atlas with
 *  its program (asked only for an atlas sign). */
export interface SignModelLook<S extends string = string> {
  readonly calligraphy: NeonText | null;
  readonly atlas: () => { readonly mat: Material; readonly atlas: SignAtlas<S> };
}

const Z = new Vector3(0, 0, 1), O = new Vector3(0, 0, 0);

/** One sign alone, centred on the origin and facing +z: its board and tubes (calligraphy) or its atlas quad. */
export function signParts<S extends string>(ctx: ModelContext, p: SignModelParams<S>, look: SignModelLook<S>, row: SignModelRow): readonly ModelPart[] {
  const key = `${row.key}:${p.style}:${p.text}:${p.color}:${p.ink ?? ''}:${String(p.vertical)}:${p.size}:${String(p.blade)}`;
  const neon = look.calligraphy;
  if (row.calligraphyStyles.includes(p.style) && neon !== null) {
    const g = ctx.once(key, () => neon.one({ text: p.text, color: p.color, vertical: p.vertical, em: p.size, at: O, facing: Z, twoSided: p.blade, gain: ((p.gain ?? row.calligraphyGain) / row.calligraphyGain) * row.tubeGain }));
    return [{ geometry: g.boards, material: neon.boardMat }, { geometry: g.tubes, material: neon.tubeMat, renderOrder: 5 }];
  }
  const atlas = look.atlas();
  const geometry = ctx.once(key, () => {
    const b = new SignBuilder(atlas.atlas);
    b.place({ at: O, normal: Z, size: p.size, spec: { text: p.text, color: p.color, vertical: p.vertical, style: p.style, ...(p.ink === undefined ? {} : { ink: p.ink }) }, blade: p.blade, ...(p.board === undefined ? {} : { board: p.board }), ...(p.gain === undefined ? {} : { gain: p.gain }) }, null);
    return b.build();
  });
  return [{ geometry, material: atlas.mat }];
}

const _up = new Vector3(), _r = new Vector3(), _c = new Vector3(), _b = new Box3();

/** a placed sign's copy: centred on its face, turned to face its normal; its world box (the face, the board's depth) */
function copyOf<S extends string>(s: PlacedSign<S>, boxes: Float32Array, i: number, row: SignModelRow): Placement<SignModelParams<S>> {
  const { p, w, h } = s;
  const side = row.sideways.includes(p.spec.style);
  _up.set(side ? 1 : 0, side ? 0 : 1, 0);
  const facing = s.neon ? p.normal.clone().setY(0).normalize() : p.normal;
  _r.crossVectors(_up, facing).normalize();
  const depth = s.neon ? row.neonDepth : p.blade === true ? row.bladeDepth : row.depth;
  _b.makeEmpty();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    _b.expandByPoint(_c.copy(p.at).addScaledVector(_r, (sx * w) / 2).addScaledVector(_up, (sy * h) / 2).addScaledVector(facing, (sz * depth) / 2 + (s.neon ? 0 : row.standoff)));
  }
  boxes.set([_b.min.x, _b.min.y, _b.min.z, _b.max.x, _b.max.y, _b.max.z], i * 6);
  const params: SignModelParams<S> = {
    style: p.spec.style, text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, size: p.size, blade: p.blade === true,
    ...(p.spec.ink === undefined ? {} : { ink: p.spec.ink }), ...(p.board === undefined ? {} : { board: p.board }), ...(p.gain === undefined ? {} : { gain: p.gain }),
  };
  return { x: p.at.x, y: p.at.y, z: p.at.z, yaw: Math.atan2(facing.x, facing.z), variant: row.variantOf[p.spec.style] ?? p.spec.style, params };
}

/** Register the signs a builder hung where they are drawn: the atlas ones on `meshes.atlas`, the calligraphy on
 *  `meshes.neon` (one `place` each; the copies are counted on the one card). */
export function registerSignCopies<S extends string>(model: ModelDef<SignModelParams<S>>, ctx: ModelContext, placed: readonly PlacedSign<S>[], meshes: { readonly atlas: Object3D; readonly neon: Object3D }, row: SignModelRow): void {
  for (const neon of [false, true]) {
    const list = placed.filter((s) => s.neon === neon);
    if (list.length === 0) continue;
    const boxes = new Float32Array(list.length * 6);
    const pls = list.map((s, i) => copyOf(s, boxes, i, row));
    place(model, pls, { ctx, draw: 'merged', drawnInto: { object: neon ? meshes.neon : meshes.atlas, boxes }, piece: { id: neon ? row.pieces.neon : row.pieces.atlas } });
  }
}
