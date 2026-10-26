/** The placed mesh metadata needed to describe existing private scene nodes. */
export interface NalatiPoiScenePlaces {
  readonly rows: readonly {
    readonly name: string;
    readonly group: string | null;
    readonly meshes: readonly { readonly name: string; readonly material: string; readonly slot: number }[];
  }[];
}

function scene(row: NalatiPoiScenePlaces['rows'][number]): { version: 1; root: string; nodes: ({ renderOrder?: number; castShadow: boolean; receiveShadow: boolean; name?: string; kind: "mesh"; id: string; geometry: string; material: string; missing: "empty"; } | { children: string[]; name?: string; kind: "group"; id: string; })[]; materials: { id: string; kind: "port"; source: string; }[]; } {
  const meshes = row.meshes.map((mesh, i) => ({ kind: 'mesh' as const, id: `mesh-${i}`, geometry: `mesh-${i}`, material: mesh.material,
    missing: 'empty' as const, ...(mesh.name === '' ? {} : { name: mesh.name }), castShadow: mesh.material !== 'yard', receiveShadow: true, ...(mesh.material === 'yard' ? { renderOrder: 1 } : {}) }));
  const children = row.meshes.map((mesh, i) => ({ slot: mesh.slot, id: `mesh-${i}` })).sort((a, b) => a.slot - b.slot).map(child => child.id);
  const nodes = row.group === null ? meshes : [{ kind: 'group' as const, id: 'root', ...(row.group === '' ? {} : { name: row.group }), children }, ...meshes];
  return { version: 1 as const, root: row.group === null ? 'mesh-0' : 'root', nodes,
    materials: [...new Set(row.meshes.map(mesh => mesh.material))].map(id => ({ id, kind: 'port' as const, source: id })) };
}

/** Describe original POI scene nodes from owned places metadata, without reading or publishing a handoff. */
export function nalatiPoiScenes(places: NalatiPoiScenePlaces): Record<string, ReturnType<typeof scene>> {
  return Object.fromEntries(places.rows.filter(row => !row.name.startsWith('actor:')).map(row => [row.name, scene(row)]));
}
