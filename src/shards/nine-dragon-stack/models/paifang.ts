/**
 * The paifang (牌坊; dome B, E169; E281; E306 / E315 M4): the memorial gate — lacquer posts on Sumeru bases, drum
 * stones, painted beams, dense dougong, thick tiled roofs with a rafter soffit and ridge beasts, the gold-framed 九龍
 * plaque (../generators/gate.ts `buildGate`). Four stand in the fragment, each drawn into its region's kit (the square's, the
 * stair's C2 terraces, the Well's two gate bridges), so they cost no draw of their own; the world records each where it
 * stands (models/inKit.ts's way, `drawnInto`). Its variants are three: the square's cinnabar and gold gate with bare
 * lacquer posts (E281, 14 m to the ridge beasts), the stair's lower one, and the gate bridges' in the hero lab's mineral
 * blue-greens with its paper couplets (the run north's far gate bridge, ~100 m from the rim, draws that one in outline:
 * ../generators/well-bridges.ts `farGate`). Built here in its own space (the centre bay on the origin, the gate across x) for
 * the Model Explorer, without its plaque's calligraphy, couplets' text and lanterns — those are signs and paper lanterns.
 * Every copy's posts collide as the model's own (E346): the square's and the gate bridges' lacquered posts, the stair's
 * post bases with their drum stones.
 */
import { defineModel, type ModelBuild, type ModelContext, type ModelVariant } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { GateSpec } from '../world/specimenDims';
import { ndLook, need, specimen, withSpecimens } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/paifang.ts';

/** the three gates in their own space, as their builders call buildGate (square.ts `paifang`, stairstreet-upper.ts
 *  `stairGate`, well-bridges.ts `gateBridge`): the posts about the centre bay */
export const PAIFANG: Readonly<Record<'square' | 'stair' | 'well', Omit<GateSpec, 'x' | 'y' | 'z'>>> = {
  square: { posts: [-5.45, -2.15, 2.15, 5.45], s: 1.85, plaque: '九龍', couplets: null, neonEaves: null, lions: false, k: 0.78, paint: 'cinnabar' },
  stair: { posts: [-5.6, -3.1, 3.1, 5.6], s: 1.3, plaque: '九龍', couplets: null, neonEaves: null, lions: false, paint: 'cinnabar' },
  well: { posts: [-5.4, -2.3, 2.3, 5.4], s: 1.05, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false },
};

export interface PaifangParams { readonly kind: keyof typeof PAIFANG }

/** a gate in its own space (G285: baked, ../generators/specimens.ts, as buildGate draws PAIFANG[kind] at the origin) */
function gate(ctx: ModelContext, kind: PaifangParams['kind']): ModelBuild {
  return withSpecimens(ctx, 'nine-dragon-stack/paifang', () => [{ geometry: specimen(ctx, `paifang:${kind}`), material: need(ndLook(ctx).mat, 'the Jiehua program') }]);
}

const variant = (kind: PaifangParams['kind'], label: string): ModelVariant<PaifangParams> => ({ id: kind, label, params: { kind } });

export const paifang = defineModel<PaifangParams>({
  id: 'nine-dragon-stack/paifang', name: 'Paifang (memorial gate)', category: 'buildings', pipeline: 'code', file: FILE, defaults: { kind: 'square' },
  variants: [variant('square', 'Lantern Square (cinnabar)'), variant('stair', 'The stair-street'), variant('well', 'The Well\'s gate bridge (mineral)')],
  build: (ctx, p) => gate(ctx, p.kind),
  colliders: (p) => postColliders(p.kind),
});

/**
 * A gate's posts in its own space (E346: they were the stair's and the crossings' boxes, generators/stairstreet.ts and
 * generators/well-bridges.ts): the square's and the gate bridges' lacquered posts, 0.9 m square and 7 m up; the stair's post
 * bases with their drum stones, 1.4 × 2.8 m (× its scale) and 9 m up, stone. The placement turns them with the gate (the
 * stair's spans the stair: its copy is turned −90°).
 */
export function postColliders(kind: PaifangParams['kind']): ColliderDesc[] {
  const g = PAIFANG[kind];
  if (kind === 'stair') return g.posts.map((x) => ({ kind: 'box', x, y: 4.5, z: 0, hx: 0.7 * g.s, hy: 4.5, hz: 1.4 * g.s, surface: 'stone' }));
  return g.posts.map((x) => ({ kind: 'box', x, y: 3.5, z: 0, hx: 0.45, hy: 3.5, hz: 0.45, surface: 'wood' }));
}
