import * as v from 'valibot';
import { GraphArmsSchema } from './graphArmsRows.ts';
import { GrappleFilamentSchema, type GrappleRows } from './grapple.ts';
import { UniformRowsSchema } from './uniformRows.ts';
import { PostGraphLookSchema } from './postGraphLook.ts';

const finite = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.maxLength(512));
const id = v.pipe(text, v.minLength(1));
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const triple = v.tuple([finite, finite, finite]);
type Storage = 'Int8Array' | 'Uint8Array' | 'Uint8ClampedArray' | 'Int16Array' | 'Uint16Array' | 'Int32Array' | 'Uint32Array' | 'Float32Array' | 'Float64Array';
interface RibbonGeometry {
  metadata: { version: number; type: 'BufferGeometry'; generator: string };
  uuid: string; type: 'BufferGeometry'; name: string;
  data: { attributes: Record<string, { itemSize: number; type: Storage; array: number[]; normalized: boolean; name?: string; usage?: number; gpuType?: number }>;
    index: { type: 'Uint16Array' | 'Uint32Array'; array: number[] } };
}
const ribbon: v.GenericSchema<RibbonGeometry, RibbonGeometry> = v.pipe(v.strictObject({
  metadata: v.strictObject({ version: finite, type: v.literal('BufferGeometry'), generator: id }),
  uuid: id, type: v.literal('BufferGeometry'), name: text,
  data: v.strictObject({ attributes: v.pipe(v.record(id, v.strictObject({
    itemSize: v.pipe(natural, v.minValue(1), v.maxValue(16)),
    type: v.picklist(['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array']),
    array: v.pipe(v.array(finite), v.maxLength(2_000_000)), normalized: v.boolean(),
    name: v.exactOptional(text), usage: v.exactOptional(natural), gpuType: v.exactOptional(natural),
  })), v.maxEntries(32)), index: v.strictObject({ type: v.picklist(['Uint16Array', 'Uint32Array']),
    array: v.pipe(v.array(v.pipe(natural, v.maxValue(0xffff_ffff))), v.maxLength(2_000_000)) }) }),
}), v.check(row => {
  const position = row.data.attributes['position'];
  if (position?.itemSize !== 3 || position.array.length % 3 !== 0) return false;
  const count = position.array.length / 3, limit = row.data.index.type === 'Uint16Array' ? 65535 : 0xffff_ffff;
  return Object.values(row.data.attributes).every(attribute => attribute.array.length === count * attribute.itemSize)
    && row.data.index.array.every(index => index < count && index <= limit);
}, 'Complete native ribbon attributes and index range'));
interface BlendState {
  blending: number; blendEquation: number; blendEquationAlpha: number;
  blendSrc: number; blendDst: number; blendSrcAlpha: number; blendDstAlpha: number;
}
type Aim = Omit<GrappleRows['aim'], 'ribbon'> & { ribbon: RibbonGeometry; filamentState: BlendState };
export interface HeldJianDocumentInput {
  portraitFov: number; aim: Aim; bursts: GrappleRows['bursts'];
  view: v.InferInput<typeof GraphArmsSchema>;
  look: { vm: v.InferInput<typeof UniformRowsSchema>; post: v.InferInput<typeof PostGraphLookSchema> };
}
export interface HeldJianDocument {
  portraitFov: number; aim: Aim; bursts: GrappleRows['bursts'];
  view: v.InferOutput<typeof GraphArmsSchema>;
  look: { vm: v.InferOutput<typeof UniformRowsSchema>; post: v.InferOutput<typeof PostGraphLookSchema> };
}
const hint = v.strictObject({ label: text, icon: v.exactOptional(text), tone: text, accent: v.exactOptional(text) });
const style = v.pipe(v.record(id, text), v.maxEntries(32));
const burst = v.strictObject({ name: id, shape: v.picklist(['flake', 'streak']),
  count: v.pipe(natural, v.minValue(1), v.maxValue(24)), life: v.pipe(finite, v.minValue(Number.MIN_VALUE), v.maxValue(1)) });

/** The complete held Jian/dragon-hook view document. Models, GLB accessors,
 * graph arms, post graphs and native grapple owners keep their own admission;
 * no callback, arbitrary aim bag, uniform bag or geometry blob is opaque here. */
export const HeldJianDocumentSchema: v.GenericSchema<HeldJianDocumentInput, HeldJianDocument> = v.strictObject({
  portraitFov: v.pipe(finite, v.minValue(1), v.maxValue(179)),
  aim: v.strictObject({ scanPerFrame: v.pipe(natural, v.minValue(1), v.maxValue(4096)), landingStale: finite,
    marks: v.pipe(natural, v.maxValue(4096)), hints: v.strictObject({ rest: hint, ready: hint, locked: hint, zip: hint, armed: hint, fire: hint }),
    chip: v.strictObject({ className: id, style, candidate: text, lockedTouch: text, lockedDesk: text, color: text, lockedColor: text }),
    mark: v.strictObject({ className: id, style, glyph: text, color: text }),
    toasts: v.strictObject({ miss: text, armedTouch: text, armedDesk: text, lockedTouch: text, lockedDesk: text }),
    muzzle: triple, slack: v.strictObject({ fire: finite, reel: finite, hold: finite }),
    ropePoints: v.pipe(natural, v.minValue(1), v.maxValue(4096)), claw: natural, halo: natural,
    flashes: v.strictObject({ muzzle: natural, bite: natural, dock: natural }), sparks: v.pipe(natural, v.maxValue(4096)),
    name: id, systems: v.strictObject({ input: id, rope: id, update: id }), debug: id, ribbon, filament: GrappleFilamentSchema,
    filamentState: v.strictObject({ blending: natural, blendEquation: natural, blendEquationAlpha: natural,
      blendSrc: natural, blendDst: natural, blendSrcAlpha: natural, blendDstAlpha: natural }),
  }),
  bursts: v.strictObject({ muzzle: burst, bite: burst, dock: burst, sparks: burst }),
  view: GraphArmsSchema, look: v.strictObject({ vm: UniformRowsSchema, post: PostGraphLookSchema }),
});
