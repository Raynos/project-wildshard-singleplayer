import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import manifest from '../manifest.json' with { type: 'json' };
import bindings from '../data/terrainBindings.json' with { type: 'json' };
import declared from '../data/publicInputs.json' with { type: 'json' };
import { pineBootInventory, pineKtx2Tables } from './bootInventory';

/** The texture baker's committed phone ASTC aliases (scripts/bake-astc6.mjs), read as the retired bake read them. */
const ASTC = 'data/astc6.generated.json';

/** The declared retained terrain's URL (its public path under `/assets/`). */
const TERRAIN_URL = `/${bindings.terrain.replace(/^public\//u, '')}`;

/** GR8 G35: the page-mode boot rows, GPU tables and capture poses as program discovery, as the retired
 *  bake-boot-metadata.mjs wrote them: the public inventory is listed through `ctx.inputFiles` over its declared roots
 *  (`publicInputs.json` `bootInventory`, the bake's eight), and each diagnostic eye keeps its probe's angles at the
 *  shipping lattice's height (the terrain read through `ctx.cached`). */
export async function pineBootProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<{
  readonly 'boot.pageModes': ReturnType<typeof pineBootInventory>; readonly 'ktx2.pageModes': ReturnType<typeof pineKtx2Tables>;
  readonly poses: Record<string, { probe: (typeof manifest.captureProbes)[number]; eye: [number, number, number]; yaw: number; pitch: number; mockup: string; frame: string }>;
}> {
  const list = ctx.inputFiles;
  if (list === undefined) throw new Error('Pine boot discovery requires the inputFiles capability');
  const inventory = Object.fromEntries(list(declared.bootInventory).filter(url => !url.endsWith('.DS_Store')).sort().map((url): [string, true] => [url, true]));
  const files = await ctx.cached({ id: 'boot-inputs', inputs: [TERRAIN_URL, ASTC] }, inputs => {
    const terrain = inputs.get(TERRAIN_URL), aliases = inputs.get(ASTC);
    if (terrain === undefined || terrain.byteLength === 0 || aliases === undefined) throw new Error('Missing declared Pine boot inputs');
    return new Map([['terrain.bin', terrain], ['astc6.json', aliases]]);
  });
  const terrain = files.get('terrain.bin'), aliases = files.get('astc6.json');
  if (terrain === undefined || aliases === undefined || files.size !== 2) throw new Error('Missing cached Pine boot inputs');
  const parsed: unknown = JSON.parse(new TextDecoder().decode(aliases));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Pine ASTC aliases must be a table');
  const astc: Record<string, string> = {};
  for (const [url, alias] of Object.entries(parsed)) {
    if (typeof alias !== 'string') throw new Error(`Pine ASTC alias ${url} must be a URL`);
    astc[url] = alias;
  }
  const { heightAt } = readNativeTerrain(terrain);
  const poses = Object.fromEntries(manifest.captureProbes.map(probe => [probe.name, {
    probe, eye: [probe.x, heightAt(probe.x, probe.z) + 1.68, probe.z] as [number, number, number],
    yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
  }]));
  return { 'boot.pageModes': pineBootInventory(inventory, astc), 'ktx2.pageModes': pineKtx2Tables(astc), poses };
}
