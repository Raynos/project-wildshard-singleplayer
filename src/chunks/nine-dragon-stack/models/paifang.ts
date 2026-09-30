/**
 * The paifang (牌坊; dome B, E169; E281; E306 / E315 M4): the memorial gate — lacquer posts on Sumeru bases, drum
 * stones, painted beams, dense dougong, thick tiled roofs with a rafter soffit and ridge beasts, the gold-framed 九龍
 * plaque (../world/gate.ts `buildGate`). Three stand in the fragment, each drawn into its region's kit (the square's, the
 * stair's C2 terraces, the Well's gate bridge), so they cost no draw of their own; the world records each where it
 * stands (models/inKit.ts's way, `drawnInto`). Its variants are those three: the square's cinnabar and gold gate with bare
 * lacquer posts (E281, 14 m to the ridge beasts), the stair's lower one, and the gate bridge's in the hero lab's mineral
 * blue-greens with its paper couplets. Built here in its own space (the centre bay on the origin, the gate across x) for
 * the Model Explorer, without its plaque's calligraphy, couplets' text and lanterns — those are signs and paper lanterns.
 */
import { defineModel, type ModelContext, type ModelPart, type ModelVariant } from '../../../models/model';
import { type GateSpec, buildGate } from '../world/gate';
import { Kit } from '../world/kit';
import { KitX, merge } from '../world/hero/kitx';
import { SignBuilder } from '../look/signs';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/chunks/nine-dragon-stack/models/paifang.ts';

/** the three gates in their own space, as their builders call buildGate (square.ts `paifang`, stairstreet-upper.ts
 *  `stairGate`, well-bridges.ts `gateBridge`): the posts about the centre bay */
export const PAIFANG: Readonly<Record<'square' | 'stair' | 'well', Omit<GateSpec, 'x' | 'y' | 'z'>>> = {
  square: { posts: [-5.45, -2.15, 2.15, 5.45], s: 1.85, plaque: '九龍', couplets: null, neonEaves: null, lions: false, k: 0.78, paint: 'cinnabar' },
  stair: { posts: [-5.6, -3.1, 3.1, 5.6], s: 1.3, plaque: '九龍', couplets: null, neonEaves: null, lions: false, paint: 'cinnabar' },
  well: { posts: [-5.4, -2.3, 2.3, 5.4], s: 1.05, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false },
};

/** the signs a specimen's gate would hang (the plaque, the couplets, eave neon): counted, not drawn — they are signs */
class NoSigns extends SignBuilder {
  skipped = 0;
  override place(): { w: number; h: number } { this.skipped++; return { w: 0, h: 0 }; }
  override tube(): void { this.skipped++; }
  override light(): void { this.skipped++; }
}

export interface PaifangParams { readonly kind: keyof typeof PAIFANG }

function gate(ctx: ModelContext, kind: PaifangParams['kind']): readonly ModelPart[] {
  const look = ndLook(ctx);
  const geometry = ctx.once(`nds:paifang:${kind}`, () => {
    const k = new Kit(), x = new KitX();
    buildGate(k, x, new NoSigns(need(look.neon, 'the sign atlas').atlas), () => undefined, { x: 0, y: 0, z: 0, ...PAIFANG[kind] });
    return merge([k.build(), x.build()]);
  });
  return [{ geometry, material: need(look.mat, 'the Jiehua program') }];
}

const variant = (kind: PaifangParams['kind'], label: string): ModelVariant<PaifangParams> => ({ id: kind, label, params: { kind } });

export const paifang = defineModel<PaifangParams>({
  id: 'nine-dragon-stack/paifang', name: 'Paifang (memorial gate)', category: 'buildings', pipeline: 'code', file: FILE, defaults: { kind: 'square' },
  variants: [variant('square', 'Lantern Square (cinnabar)'), variant('stair', 'The stair-street'), variant('well', 'The Well\'s gate bridge (mineral)')],
  build: (ctx, p) => gate(ctx, p.kind),
});
