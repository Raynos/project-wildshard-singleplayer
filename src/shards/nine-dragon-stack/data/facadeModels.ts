// The facade kit's models as rows (SHARD-PLATFORM M3, ex models/facade.ts): one Model Explorer card per drawn piece, in
// the catalogue's order — the piece id it draws (world/facade/pieceIds.ts), its card id and name, its category, the
// aliases the batch draws with its geometry (the Explorer's variants: id, label) and whether it is baked into the facade
// shell (FACADE_BAKED: the few-and-small pieces, no distance LOD) or drawn as its own instanced piece (FACADE_MODELS).

/** a facade piece's card: the piece it draws, its id under the shard, name, category, aliases and whether the shell bakes it */
export interface FacadeModelRow {
  readonly piece: string;
  readonly slug: string;
  readonly name: string;
  readonly category: 'buildings' | 'props' | 'nature';
  readonly variants?: readonly (readonly [string, string])[];
  readonly baked?: boolean;
}

/** every facade piece's card, the instanced pieces first, then the shell's baked ones */
export const FACADE_MODEL_ROWS: readonly FacadeModelRow[] = [
  { piece: 'balcony', slug: 'facade-balcony', name: 'Balcony (railed)', category: 'buildings' },
  { piece: 'balconySolid', slug: 'facade-balcony-solid', name: 'Balcony (carved parapet)', category: 'buildings' },
  { piece: 'balconyTimber', slug: 'facade-balcony-timber', name: 'Timber veranda balcony', category: 'buildings' },
  { piece: 'cage', slug: 'facade-cage', name: 'Window cage', category: 'buildings', variants: [['cageS', 'Narrow (1.5 m)'], ['cageW', 'Wide (2.7 m)']] },
  { piece: 'acUnit', slug: 'facade-ac-unit', name: 'Air-con condenser', category: 'props' },
  { piece: 'pipe', slug: 'facade-pipe', name: 'Drain pipe', category: 'buildings' },
  { piece: 'laundryOut', slug: 'facade-laundry-out', name: 'Laundry pole (out from the wall)', category: 'props' },
  { piece: 'laundryAlong', slug: 'facade-laundry-along', name: 'Laundry pole (along the wall)', category: 'props' },
  { piece: 'plant', slug: 'facade-plant', name: 'Potted plant (sill)', category: 'nature' },
  { piece: 'planter', slug: 'facade-planter', name: 'Planter trough', category: 'nature' },
  { piece: 'tank', slug: 'facade-tank', name: 'Rooftop water tank', category: 'props' },
  { piece: 'shack', slug: 'facade-shack', name: 'Rooftop shack (malachite · azurite roof)', category: 'buildings' },
  { piece: 'box', slug: 'facade-box', name: 'Wall box (ledge · bay box · gallery post)', category: 'buildings', variants: [['ledge', 'Ledge'], ['bayBox', 'Bay box'], ['post', 'Gallery post']] },
  { piece: 'eave', slug: 'facade-eave', name: 'Pent eave strip', category: 'buildings' },
  { piece: 'rail', slug: 'facade-rail', name: 'Lattice railing', category: 'buildings' },
  { piece: 'antenna', slug: 'facade-antenna', name: 'Antenna mast', category: 'props' },
  { piece: 'dish', slug: 'facade-dish', name: 'Satellite dish', category: 'props' },
  { piece: 'lantern', slug: 'facade-lantern', name: 'Wall lantern (red paper, facade)', category: 'props' },
  { piece: 'couplet', slug: 'facade-couplet', name: 'Red paper couplet (春聯)', category: 'props', baked: true },
  { piece: 'shutter', slug: 'facade-shutter', name: 'Roll shutter (a closed shop)', category: 'buildings', baked: true },
  { piece: 'signFlat', slug: 'facade-sign-flat', name: 'Flat sign board', category: 'props', baked: true },
  { piece: 'signBox', slug: 'facade-sign-box', name: 'Lit sign box', category: 'props', baked: true },
  { piece: 'acBox', slug: 'facade-ac-box', name: 'Window air-con box', category: 'props', baked: true },
  { piece: 'washLine', slug: 'facade-wash-line', name: 'Wash on a street line', category: 'props', baked: true },
  { piece: 'awning', slug: 'facade-awning', name: 'Striped window awning', category: 'props', baked: true },
];
