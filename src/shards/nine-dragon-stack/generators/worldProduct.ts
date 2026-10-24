import { parseGlb } from '@wildshard/sdk/assets';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { nineScene } from './scene';
import type { BakedScene } from '@wildshard/sdk/bake';
import type { NineSpillAtlas } from './spillBake';

export interface NineWorldProduct {
  readonly metadata: {
    readonly version: 1;
    readonly notice: string;
    readonly libraries: Record<'layout' | 'boot' | 'explorer', string[]>;
    readonly specimenBoxes: Record<string, boolean>;
    readonly shardfile: BakedScene['shardfile'] & { library: string[] };
    readonly props: NonNullable<BakedScene['props']>['props'] | undefined;
    readonly report: NonNullable<BakedScene['props']>['report'] | undefined;
  };
  readonly layout: Pick<ReturnType<typeof nineScene>['layout'], 'rows' | 'records'> & {
    readonly version: 1; readonly count: number;
    readonly bounds: { readonly sphere: number[]; readonly box: number[] }[];
  };
  readonly assets: Map<string, Uint8Array>;
}

/** Preserve the existing layout wire's signed-zero/nonfinite encoding at its explicit adapter boundary. */
export function nineLayoutWord(_key: string, value: unknown): unknown {
  return typeof value === 'number' && Object.is(value, -0) ? '-0'
    : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : value;
}

/** Project the source layout without also baking unrelated world GLBs and spill channels. */
export function nineWorldLayout(layout: ReturnType<typeof nineScene>['layout']): NineWorldProduct['layout'] {
  const bounds = layout.geometries.map(geometry => {
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const { boundingSphere: sphere, boundingBox: box } = geometry;
    if (sphere === null || box === null) throw new Error('Nine layout geometry has no bounds');
    return { sphere: [...sphere.center, sphere.radius], box: [...box.min, ...box.max] };
  });
  return { version: 1, count: layout.records.length, records: layout.records, rows: layout.rows, bounds };
}

/** Original world bake as owned data and bytes, with no file writes or scene publication.
 * The retained file adapter and the source product call this same function. */
export function nineWorldProduct(atlas?: NineSpillAtlas): NineWorldProduct {
  const product = nineScene(undefined, atlas), { baked } = product;
  const libraries: Record<'layout' | 'boot' | 'explorer', string[]> = { layout: [], boot: [], explorer: [] };
  const assets = new Map(baked.assets), files = [...baked.shardfile.files];
  for (const part of baked.pieces) {
    const hash = hashImmutableBytes(part.glb); assets.set(hash, part.glb);
    files.push({ hash, kind: 'glb', compressed: part.glb.length, ...parseGlb(part.glb), dependencies: [], critical: false });
    const section = part.name.startsWith('layout_sets_') ? 'layout' : part.name.startsWith('specimens_boot_') ? 'boot' : 'explorer';
    libraries[section].push(hash);
  }
  const layout = nineWorldLayout(product.layout);
  files.sort((a, b) => a.hash.localeCompare(b.hash));
  const metadata: NineWorldProduct['metadata'] = { version: 1, notice: 'DO NOT EDIT: generators/bake-nine-layout.mjs through bake(scene, identity).',
    libraries, specimenBoxes: product.boxes,
    shardfile: { ...baked.shardfile, files, library: [...new Set([...libraries.layout, ...libraries.boot, ...libraries.explorer,
      ...(baked.props?.props.tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? [])) ?? [])])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0) }, props: baked.props?.props, report: baked.props?.report };
  return { metadata, layout, assets };
}
