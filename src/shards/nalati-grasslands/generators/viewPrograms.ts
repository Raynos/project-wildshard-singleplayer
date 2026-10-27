import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

/** The script compiler / admission revisions a view module is admitted under (the caller's SCRIPT_V2_REVISIONS). */
export interface NalatiViewRevisions { readonly compiler: 1; readonly admission: 1 }
/** One view module's authored source, product name and fixed-page ABI-2 bounds. */
export interface NalatiViewModule {
  readonly id: string; readonly source: string; readonly name: string; readonly pages: number; readonly ioBytes: number;
}
/** GR6: the creature, elite and Titan view modules (G600 L8), compiled in the build from their authored sources with the
 *  bounds the retired `nalati-*-view(s)` jobs used; the engine's view program runs each from its rows (client plan
 *  view.program). The Titan fire view keeps its three pages. */
export const NALATI_VIEW_MODULES: readonly NalatiViewModule[] = [
  { id: 'creature-views', source: 'behaviour/creatureViews.as', name: 'views/nalati.creature-views.wasm', pages: 1, ioBytes: 8192 },
  { id: 'elite-views', source: 'behaviour/eliteViews.as', name: 'views/nalati.elite-views.wasm', pages: 1, ioBytes: 4096 },
  { id: 'titan-view', source: 'behaviour/titanView.as', name: 'views/nalati.titan-view.wasm', pages: 1, ioBytes: 4096 },
  { id: 'titan-fire-view', source: 'behaviour/titanFireView.as', name: 'views/nalati.titan-fire-view.wasm', pages: 3, ioBytes: 81920 },
  { id: 'titan-whirls-view', source: 'behaviour/titanWhirlsView.as', name: 'views/nalati.titan-whirls-view.wasm', pages: 1, ioBytes: 16384 },
];
/** The view modules' live and last-good pages a client holds. */
export const NALATI_VIEW_PAGES: number = NALATI_VIEW_MODULES.reduce((sum, row) => sum + row.pages, 0);

/** Compile each view module from its declared source under the full author-program identity and publish it with its
 *  original critical ABI-2 view admission. */
export async function nalatiViewModules(ctx: Pick<ProjectGenerationContext, 'cached' | 'compileScriptV2'>, revisions: NalatiViewRevisions): Promise<NamedBlob[]> {
  const blobs: NamedBlob[] = [];
  for (const row of NALATI_VIEW_MODULES) {
    const files = await ctx.cached({ id: `view-${row.id}`, inputs: [row.source] }, async inputs => {
      const source = inputs.get(row.source);
      if (source === undefined) throw new Error(`Missing Nalati view source ${row.source}`);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(source);
      const bytes = await ctx.compileScriptV2(text, { lane: 'view', ioBytes: row.ioBytes, ...(row.pages > 1 ? { maximumPages: row.pages } : {}) });
      return new Map([['view.wasm', bytes]]);
    });
    const bytes = files.get('view.wasm');
    if (files.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error(`Nalati view ${row.id} cache inventory differs`);
    blobs.push(nameBlob(row.name, 'wasm', bytes, { critical: true, script: { abi: 2, lane: 'view', pages: row.pages, ioBytes: row.ioBytes,
      compilerRevision: revisions.compiler, admissionRevision: revisions.admission } }));
  }
  return blobs;
}

/** The `view/modules` rows naming each compiled module by its content address, as the retired jobs' metadata did. */
export function nalatiViewSection(blobs: readonly NamedBlob[], revisions: NalatiViewRevisions): { id: string; module: string; side: 'view'; abi: 2; lane: 'view'; pages: number; ioBytes: number; compilerRevision: 1; admissionRevision: 1 }[] {
  return NALATI_VIEW_MODULES.map(row => {
    const blob = blobs.find(entry => entry.file.name === row.name);
    if (blob === undefined) throw new Error(`Missing compiled Nalati view ${row.id}`);
    return { id: `nalati.${row.id}`, module: `blobs/wasm/${blob.file.hash}.wasm`, side: 'view', abi: 2, lane: 'view', pages: row.pages, ioBytes: row.ioBytes,
      compilerRevision: revisions.compiler, admissionRevision: revisions.admission };
  });
}
