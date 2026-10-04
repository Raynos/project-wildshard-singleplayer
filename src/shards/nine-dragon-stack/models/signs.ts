/**
 * The sign (E306 / E315 second pass): every shop sign, plaque, paper strip and banner the fragment hangs — hand-bent
 * neon calligraphy on a dark plank board (look/neonsigns.ts: the SDF glyphs lit over their board), a lightbox (a
 * mono atlas word glowing in its tint), a gold-lettered plaque, a paper strip (the menus, the couplets, 福), a cloth
 * banner (麵). One model, its variants the styles; a copy's params are its words, colours and size. The fragment draws
 * them as it always has — the lightboxes, plaques, strips and banners are quads in the one `signs` mesh over the sign
 * atlas, the neon ones the `neon` boards and tubes — and build.ts registers every copy there (`place` with `drawnInto`,
 * `registerSigns`), so a sign costs no draw of its own. Built here alone, centred on the origin and facing +z, for the
 * Model Explorer; a variant's words are ones the fragment hangs (its atlas cell is drawn: the atlas is finished once).
 */
import { Box3, Vector3, type Object3D } from 'three';
import { defineModel, type ModelContext, type ModelPart, type ModelVariant, type Placement } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import { type PlacedSign, SignBuilder, type SignStyle } from '../look/signs';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/signs.ts';

export interface SignParams {
  readonly style: SignStyle;
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

/** a variant per style, each with words the fragment hangs (their atlas cells are drawn) */
const VARIANTS: readonly ModelVariant<SignParams>[] = [
  { id: 'neon', label: 'Neon calligraphy (重慶小麵)', params: { style: 'tube', text: '重慶小麵', color: '#ff3b30', vertical: false, size: 0.5, gain: 5 } },
  { id: 'lightbox', label: 'Lightbox (九記牛腩麵)', params: { style: 'box', text: '九記牛腩麵', color: '#fff1dc', vertical: false, size: 0.34, board: 0xa8261a, gain: 2.0 } },
  { id: 'plaque', label: 'Plaque (福德祠)', params: { style: 'plaque', text: '福德祠', color: '#f0c86a', vertical: false, size: 0.13, gain: 1.3 } },
  { id: 'paper', label: 'Paper strip (牛腩麵)', params: { style: 'paper', text: '牛腩麵', color: '#f3e7cf', ink: '#b8261a', vertical: true, size: 0.13, gain: 1.15 } },
  { id: 'banner', label: 'Banner (麵)', params: { style: 'banner', text: '麵', color: '#b8261a', ink: '#efe8d8', vertical: true, size: 0.72, blade: true, gain: 1.35 } },
];

/** the variant a style is shown as */
const variantOf = (style: SignStyle): string => (style === 'tube' ? 'neon' : style === 'box' ? 'lightbox' : style);

const Z = new Vector3(0, 0, 1), O = new Vector3(0, 0, 0);

function build(ctx: ModelContext, p: SignParams): readonly ModelPart[] {
  const look = ndLook(ctx);
  const key = `nds:sign:${p.style}:${p.text}:${p.color}:${p.ink ?? ''}:${String(p.vertical)}:${p.size}:${String(p.blade)}`;
  const neon = look.calligraphy;
  if (p.style === 'tube' && neon !== null) {
    const g = ctx.once(key, () => neon.one({ text: p.text, color: p.color, vertical: p.vertical, em: p.size, at: O, facing: Z, twoSided: p.blade, gain: ((p.gain ?? 4.4) / 4.4) * 4.2 }));
    return [{ geometry: g.boards, material: neon.boardMat }, { geometry: g.tubes, material: neon.tubeMat, renderOrder: 5 }];
  }
  const atlas = need(look.neon, 'the sign atlas');
  const geometry = ctx.once(key, () => {
    const b = new SignBuilder(atlas.atlas);
    b.place({ at: O, normal: Z, size: p.size, spec: { text: p.text, color: p.color, vertical: p.vertical, style: p.style, ...(p.ink === undefined ? {} : { ink: p.ink }) }, blade: p.blade, ...(p.board === undefined ? {} : { board: p.board }), ...(p.gain === undefined ? {} : { gain: p.gain }) }, null);
    return b.build();
  });
  return [{ geometry, material: atlas.mat }];
}

export const sign = defineModel<SignParams>({
  id: 'nine-dragon-stack/sign', name: 'Sign (neon, lightbox, plaque, paper strip, banner)', category: 'props', pipeline: 'code', file: FILE,
  defaults: { style: 'tube', text: '重慶小麵', color: '#ff3b30', vertical: false, size: 0.5, blade: false, gain: 5 },
  variants: VARIANTS,
  build: (ctx, p) => build(ctx, p),
  specimenYaw: Math.PI, // (the Explorer's camera looks down +z: turned, the sign's face (+z) faces it)
});

const _up = new Vector3(), _r = new Vector3(), _c = new Vector3(), _b = new Box3();

/** a placed sign's copy: centred on its face, turned to face its normal; its world box (the face, the board's depth) */
function copyOf(s: PlacedSign, boxes: Float32Array, i: number): Placement<SignParams> {
  const { p, w, h } = s;
  const etch = p.spec.style === 'etch';
  _up.set(etch ? 1 : 0, etch ? 0 : 1, 0);
  const facing = s.neon ? p.normal.clone().setY(0).normalize() : p.normal;
  _r.crossVectors(_up, facing).normalize();
  const depth = s.neon ? 0.09 : p.blade === true ? 0.12 : 0.1;
  _b.makeEmpty();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    _b.expandByPoint(_c.copy(p.at).addScaledVector(_r, (sx * w) / 2).addScaledVector(_up, (sy * h) / 2).addScaledVector(facing, (sz * depth) / 2 + (s.neon ? 0 : 0.03)));
  }
  boxes.set([_b.min.x, _b.min.y, _b.min.z, _b.max.x, _b.max.y, _b.max.z], i * 6);
  const params: SignParams = {
    style: p.spec.style, text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, size: p.size, blade: p.blade === true,
    ...(p.spec.ink === undefined ? {} : { ink: p.spec.ink }), ...(p.board === undefined ? {} : { board: p.board }), ...(p.gain === undefined ? {} : { gain: p.gain }),
  };
  return { x: p.at.x, y: p.at.y, z: p.at.z, yaw: Math.atan2(facing.x, facing.z), variant: variantOf(p.spec.style), params };
}

/**
 * Register the fragment's signs where they are drawn: the atlas ones on the `signs` mesh, the neon calligraphy on the
 * neon boards (one `place` each; the copies are counted on the one card)
 */
export function registerSigns(ctx: ModelContext, placed: readonly PlacedSign[], meshes: { readonly atlas: Object3D; readonly neon: Object3D }): void {
  for (const neon of [false, true]) {
    const list = placed.filter((s) => s.neon === neon);
    if (list.length === 0) continue;
    const boxes = new Float32Array(list.length * 6);
    const pls = list.map((s, i) => copyOf(s, boxes, i));
    place(sign, pls, { ctx, draw: 'merged', drawnInto: { object: neon ? meshes.neon : meshes.atlas, boxes }, piece: { id: neon ? 'nds-signs-neon' : 'nds-signs' } });
  }
}

