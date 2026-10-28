import { MODEL_FILES } from './modelPaint.mjs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

const publicPrefix = '/assets/nalati/baked/painted-models/';
const productPrefix = 'models/painted/';
/** Equal atlas bytes have one logical product name, so shared images never create forbidden content aliases. */
export function nalatiPaintedAtlasFile(bytes: Uint8Array): string { return `${productPrefix}atlas-${hashImmutableBytes(bytes)}.ktx2`; }

/** Near tier geometry may be identical after stripping its atlas; retain the existing untextured far names. */
export function nalatiPaintedGeometryFile(name: string, bytes: Uint8Array): string {
  return name.endsWith('.far.glb') ? `${productPrefix}${name}` : `${productPrefix}geometry-${hashImmutableBytes(bytes)}.glb`;
}

function modelName(path: string, prefix: string): string {
  const name = path.slice(prefix.length);
  if (!MODEL_FILES.includes(name)) throw new Error('Unknown Nalati painted model binding');
  return name;
}

/** Select only the painted models actually declared by complete compiled scene rows. */
export function nalatiPaintedModelNames(input: unknown): readonly string[] {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string' && value.startsWith(publicPrefix)) names.add(modelName(value, publicPrefix));
    else if (Array.isArray(value)) { for (const item of value) visit(item); }
    else if (value !== null && typeof value === 'object') {
      const file: unknown = Reflect.get(value, 'file');
      if (typeof file === 'string' && file.startsWith(productPrefix)) names.add(modelName(file, productPrefix));
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(input);
  return [...names].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

/** Replace only declared painted asset locations; original geometry/material/placement fields keep their order and values. */
export function nalatiPaintedBindings(input: unknown, files: ReadonlyMap<string, Uint8Array>): unknown {
  if (Array.isArray(input)) return input.map(value => nalatiPaintedBindings(value, files));
  if (input === null || typeof input !== 'object') return input;
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(input).map(([key, value]: [string, unknown]) => [key, nalatiPaintedBindings(value, files)]));
  for (const [sourceKey, atlasKey] of [['url', 'atlas'], ['phoneUrl', 'phoneAtlas']] as const) {
    const path = out[sourceKey];
    if (typeof path !== 'string' || !path.startsWith(publicPrefix)) continue;
    const name = modelName(path, publicPrefix), geometry = files.get(name);
    if (geometry === undefined) throw new Error(`Missing owned Nalati model geometry: ${name}`);
    out[sourceKey] = { file: nalatiPaintedGeometryFile(name, geometry), bytes: geometry.byteLength };
    if (!name.endsWith('.far.glb')) {
      const texture = name.replace(/\.glb$/u, '.ktx2'), atlas = files.get(texture);
      if (atlas === undefined) throw new Error(`Missing owned Nalati model atlas: ${texture}`);
      if (out[atlasKey] !== undefined) throw new Error('Nalati painted model already declares an atlas');
      out[atlasKey] = { file: nalatiPaintedAtlasFile(atlas), bytes: atlas.byteLength,
        wrapS: 10497, wrapT: 10497, minFilter: 9987, magFilter: 9729, anisotropy: 4, colourSpace: 'srgb' };
    }
  }
  return out;
}

/** Unselected desktop alternatives stay admitted but warm after control. A
 * shared or phone-selected reference anywhere in the books keeps its source. */
export function nalatiLatePaintedNames(input: unknown): readonly string[] {
  const candidates = new Set<string>(), selected = new Set<string>();
  const paintedFile = (value: unknown): string | undefined => {
    if (value === null || typeof value !== 'object' || !('file' in value)) return undefined;
    return typeof value.file === 'string' && value.file.startsWith('models/painted/') ? value.file : undefined;
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { selected.add(value); return; }
    if (Array.isArray(value)) { for (const child of value) visit(child); return; }
    if (value === null || typeof value !== 'object') return;
    const skipped = new Set<string>();
    for (const [normal, phone] of [['url', 'phoneUrl'], ['atlas', 'phoneAtlas']] as const) {
      const full = paintedFile(Reflect.get(value, normal)), small = paintedFile(Reflect.get(value, phone));
      if (full !== undefined && small !== undefined) { candidates.add(full); skipped.add(normal); }
    }
    for (const [key, child] of Object.entries(value)) if (!skipped.has(key)) visit(child);
  };
  visit(input);
  return [...candidates].filter(name => !selected.has(name)).sort();
}

/** Metadata-only specimen books do not draw the world. Keep any shared scene
 * source early; only exclusively declared after-control catalogue files defer. */
export function nalatiLateCatalogueNames(input: unknown): readonly string[] {
  const late=new Set<string>(),early=new Set<string>();
  const collect=(value:unknown,into:Set<string>):void=>{
    if(Array.isArray(value)){for(const child of value)collect(child,into);return;}
    if(value!==null&&typeof value==='object'){
      if('file'in value&&typeof value.file==='string')into.add(value.file);
      for(const child of Object.values(value))collect(child,into);
    }
  };
  if(input===null||typeof input!=='object'||!('catalogues'in input)||!Array.isArray(input.catalogues))return [];
  const books:readonly unknown[]=input.catalogues;
  for(const book of books)collect(book,book!==null&&typeof book==='object'&&'load'in book&&book.load==='after-control'?late:early);
  for(const [key,value]of Object.entries(input))if(key!=='catalogues')collect(value,early);
  return [...late].filter(name=>!early.has(name)).sort();
}

/** The phone never opens the desktop dressing book. Only names exclusive to
 * that book may skip the eager warm; other books and entered programme sources
 * win. Actual desktop demand still reads the same files immediately. */
export function nalatiLateDressingNames(books: ReadonlyMap<string, unknown>, names: ReadonlySet<string>, immediate: unknown): readonly string[] {
  const desktop = 'world/dressing-desktop.json', phone = 'world/dressing-phone.json';
  if (!books.has(desktop) || !books.has(phone)) throw new Error('Missing dressing timing books');
  const collect = (value: unknown, into: Set<string>): void => {
    if (typeof value === 'string') { if (names.has(value)) into.add(value); }
    else if (Array.isArray(value)) { for (const child of value) collect(child, into); }
    else if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) collect(child, into); }
  };
  const candidates = new Set<string>([desktop]), shared = new Set<string>();
  for (const [name, value] of books) collect(value, name === desktop ? candidates : shared);
  collect(immediate, shared);
  return [...candidates].filter(name => names.has(name) && !shared.has(name)).sort();
}

/** Annotate already-constructed scene data; the original complete named-file
 * schema remains its publication guard. No geometry or catalogue row changes. */
export function nalatiDeferredCatalogueScene(input:unknown):unknown{
  if(input===null||typeof input!=='object'||!('catalogues'in input)||!Array.isArray(input.catalogues))throw new Error('Missing scene catalogues');
  const books:readonly unknown[]=input.catalogues;
  const sites:readonly unknown[]='sites'in input&&Array.isArray(input.sites)?input.sites:[];
  const drawn=new Set(sites.flatMap(site=>site!==null&&typeof site==='object'&&'model'in site&&typeof site.model==='string'?[site.model]:[]));
  const catalogues:object[]=[];
  for(const book of books){
    if(book===null||typeof book!=='object'||Array.isArray(book))throw new Error('Invalid scene catalogue');
    const rows:readonly unknown[]='rows'in book&&Array.isArray(book.rows)?book.rows:[];
    const direct=rows.some(row=>row!==null&&typeof row==='object'&&'model'in row&&row.model!==null&&typeof row.model==='object'
      &&'id'in row.model&&typeof row.model.id==='string'&&drawn.has(row.model.id));
    catalogues.push(direct?{...book}:{...book,load:'after-control'});
  }
  return{...input,catalogues};
}

/** Read-only projection of rows already admitted by the caller's held schema. */
interface HeldPoolTiming {
  readonly slots: readonly {
    readonly id: string; readonly kind: string; readonly file?: string;
    readonly source?: string | { readonly kind: string; readonly file?: string };
    readonly geometry?: 'on-select';
  }[];
  readonly equipment: { readonly primary: string };
  readonly selection: { readonly initial?: string };
}

/** Hints follow admitted deferred slots, never their item names. Primary and
 * initial equipment stay early; any eager alias of the same pool also wins. */
export function nalatiLateHeldNames(rows: HeldPoolTiming, pools: ReadonlyMap<string, string>): readonly string[] {
  const late = new Set<string>(), early = new Set<string>();
  for (const row of rows.slots) {
    const file = 'file' in row ? row.file : row.kind === 'blade' && typeof row.source === 'object' && row.source.kind === 'passes' ? row.source.file : undefined;
    const pool = file === undefined ? undefined : pools.get(file);
    if (pool === undefined) continue;
    const deferred = row.kind === 'polearm' && row.geometry === 'on-select'
      && row.id !== rows.equipment.primary && row.id !== rows.selection.initial;
    (deferred ? late : early).add(pool);
  }
  return [...late].filter(name => !early.has(name)).sort();
}

/** Individual Explorer atlas variants are not the merged skin used by live
 * camp figures. Any atlas also named by the entered group keeps its eager loan. */
export function nalatiLateFigureNames(catalogue: unknown, enteredAtlas: unknown): readonly string[] {
  const late = new Set<string>(), early = new Set<string>();
  const collect = (value: unknown, names: Set<string>): void => {
    if (typeof value === 'string' && value.startsWith('models/people/') && value.endsWith('.glb')) names.add(value);
    else if (Array.isArray(value)) for (const child of value) collect(child, names);
    else if (value !== null && typeof value === 'object') for (const child of Object.values(value)) collect(child, names);
  };
  if (catalogue !== null && typeof catalogue === 'object' && 'entries' in catalogue && Array.isArray(catalogue.entries)) {
    const entries: readonly unknown[] = catalogue.entries;
    for (const row of entries) {
      if (row !== null && typeof row === 'object' && 'kind' in row && row.kind === 'kit-figure' && 'atlases' in row) collect(row.atlases, late);
    }
  }
  collect(enteredAtlas, early);
  return [...late].filter(name => !early.has(name)).sort();
}
