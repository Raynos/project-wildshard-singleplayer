import type { SpecimenBindings } from '../data/specimenBindings';

type Asset = SpecimenBindings['assets'][keyof SpecimenBindings['assets']];
interface CatalogueRow { readonly key: string; readonly source: { readonly kind: string; readonly asset?: Asset } }
/** Original specimen wire values; consumers keep their existing catalogue/material admission. */
export interface NalatiSpecimenRows<Catalogue extends readonly CatalogueRow[], Packed extends object> {
  readonly catalogue: Catalogue;
  readonly materials: Readonly<Record<string, Asset['material']>>;
  readonly packed: Packed & { readonly bin: string };
  readonly assets: Readonly<Record<string, Asset>>;
}

/** Compose detached specimen declarations from caller-owned packed metadata, without file publication. */
export function nalatiSpecimenRows<Catalogue extends readonly CatalogueRow[], Packed extends object>(catalogue: Catalogue, materials: Readonly<Record<string, Asset['material']>>, packed: Packed): NalatiSpecimenRows<Catalogue, Packed> {
  const rows = { catalogue: structuredClone(catalogue), materials: structuredClone(materials),
    packed: { ...structuredClone(packed), bin: '/assets/nalati/baked/specimens.bin' } };
  const assets: Record<string, Asset> = {};
  for (const row of rows.catalogue) if (row.source.kind === 'asset') {
    if (row.source.asset === undefined) throw new Error(`Missing original Nalati asset ${row.key}`);
    assets[row.key] = row.source.asset;
  }
  const painted = [
    { name: 'boulder-1', url: '/assets/nalati/baked/painted-models/boulder-1.glb', phoneUrl: '/assets/nalati/baked/painted-models/boulder-1.phone.glb' },
    { name: 'boulder-2', url: '/assets/nalati/baked/painted-models/boulder-2.glb', phoneUrl: '/assets/nalati/baked/painted-models/boulder-2.phone.glb' },
    { name: 'boulder-3', url: '/assets/nalati/baked/painted-models/boulder-3.glb', phoneUrl: '/assets/nalati/baked/painted-models/boulder-3.phone.glb' },
    { name: 'balbal', url: '/assets/nalati/baked/painted-models/balbal.glb', phoneUrl: '/assets/nalati/baked/painted-models/balbal.phone.glb' },
  ];
  for (const { name, url, phoneUrl } of painted) {
    const rim = name === 'balbal' ? .35 : .3;
    assets[name] = { url, phoneUrl,
      geometrySlot: 0, materialSlot: 0, retainedAttribute: '_paint_clone', material: { id: `nalati-model:${name}|near|${rim}|0.8||ffffff`, family: 'painterly', rim, bands: .8, floor: .2 } };
  }
  const rider = assets['kokparRider'];
  if (rider === undefined) throw new Error('Missing original Nalati rider asset');
  assets['kokparRiderFar'] = { ...rider, url: { file: 'models/painted/kokpar-rider.far.glb', bytes: 26384 }, phoneUrl: { file: 'models/painted/kokpar-rider.far.glb', bytes: 26384 },
    material: { ...rider.material, id: 'nalati-model:kokpar-rider|far|0.8|0.85||ffffff' } };
  return { ...rows, assets };
}
