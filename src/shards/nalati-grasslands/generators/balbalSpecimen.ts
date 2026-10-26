const sites: { name: string; label: string; file: string; surface: string; variants: string[]; variantCycle: number[]; sink: number; collider: { hw: number; hd: number; top: number; bottom: number; }; } = { name: 'nalati-balbal', label: 'Balbal', file: 'src/shards/nalati-grasslands/generators/places.ts',
  surface: 'stone', variants: ['bare', 'capped'], variantCycle: [1, 0, 0], sink: .18,
  collider: { hw: .42, hd: .33, top: 2.2, bottom: 1 } };

/** Caller-admitted specimen declarations; catalogue admission stays at each defining reader. */
export interface NalatiBalbalSpecimen<Asset extends object> {
  readonly catalogue: unknown;
  readonly generated: Asset & { transform: { yaw: number; scale: number } };
  readonly sites: typeof sites;
  readonly sources: readonly { name: string; kind: 'bin'; source: string }[];
}

/** Compose the original carving variants and encounter sites from supplied native geometry.
 * No source file, runtime reader or binary publication is involved. */
export function nalatiBalbalSpecimen<Geometry, Asset extends object>(bare: Geometry, capped: Geometry, asset: Asset, material: unknown, height: number): NalatiBalbalSpecimen<Asset> {
  if (!Number.isFinite(height) || height <= 0) throw new Error('Balbal requires a positive native model height');
  const generated = { ...structuredClone(asset), transform: { yaw: Math.PI, scale: 2.15 / height } };
  const sources: { name: string; kind: 'bin'; source: string }[] = [];
  const carving = (variant: number, geometry: Geometry): object => {
    const source = `data/balbal-carving-${String(variant)}.generated.bin`, file = `models/specimens/balbal-${String(variant)}.bin`;
    sources.push({ name: file, kind: 'bin', source });
    return { kind: 'file', file, representation: 'parts', geometry: structuredClone(geometry), material: structuredClone(material) };
  };
  const catalogue = [{ key: 'balbal', model: { id: 'nalati-grasslands/balbal', name: 'Balbal', category: 'props', pipeline: ['trellis', 'code'],
    file: 'src/shards/nalati-grasslands/generators/places.ts', surface: 'stone', defaults: { carved: null },
    variants: [{ id: 'generated', label: 'TRELLIS.2', params: {} }, { id: 'bare', label: 'Carved', params: { carved: 'bare' } }, { id: 'capped', label: 'Carved · cap', params: { carved: 'capped' } }] },
  source: { kind: 'selection', variants: [{ params: { carved: null }, source: { kind: 'asset', asset: generated } },
    { params: { carved: 'bare' }, source: carving(0, bare) }, { params: { carved: 'capped' }, source: carving(1, capped) }] } }];
  return { catalogue, generated, sites: structuredClone(sites), sources };
}
