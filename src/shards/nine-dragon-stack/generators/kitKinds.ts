/**
 * G5: the kit kinds that draw apart (layout.ts `splitKinds`), each through the kit graph with its kind fixed (kitKindGraphs.ts),
 * so their faces carry none of the other kinds' registers: the flagstones (kind 3, 72 % of the phone's street pose (a)) and
 * the plain walls (kind 0, most of a street-level frame). The table alone, with no imports: the layout bake reads it, and the
 * kit graphs' module chain reaches the casts that import the layout.
 */
export const KIT_KINDS: readonly { readonly kind: number; readonly look: string; readonly material: string }[] = [
  { kind: 3, look: 'nine-architecture-ground', material: 'kit-ground' },
  { kind: 0, look: 'nine-architecture-plain', material: 'kit-plain' },
];
// QD5 (11-03): no smaller kind pays to draw apart. The inset panels (kind 9: D 14 %, A 6.6 % of the phone poses' pixels)
// apart cost 5 draws and +0.07 / +0.08 ms at B / D on the GPU ruler (e40e24f62f vs c98d1cffe0), more than the kit
// program's branches they shed; the carved panels (kind 5) apart put a slab tile past the SDK's 64-chunk cap.

/** a split kind's row (its look and world-scene material) */
export function kitKind(kind: number): (typeof KIT_KINDS)[number] {
  const row = KIT_KINDS.find(entry => entry.kind === kind); if (row === undefined) throw new Error(`Nine kit kind ${kind} does not draw apart`);
  return row;
}
