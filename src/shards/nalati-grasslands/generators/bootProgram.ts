import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { nalatiNavigationSource, NALATI_NAVIGATION_INPUT, NALATI_NAVIGATION_URL } from './navigation';
import { nalatiGeographyRows } from './geographySource';
import { nalatiBootInventory } from './bootInventory';
import { nalatiBootAssets } from './bootFiles';
import discovery from '../data/discovery.json' with { type: 'json' };
import budgetInputs from '../data/budgetInputs.json' with { type: 'json' };
import ceilings from '../data/budgetCeilings.json' with { type: 'json' };
import declared from '../data/bootInventory.json' with { type: 'json' };

/** The retained terrain the diagnostic eyes stand on. */
const TERRAIN_URL = '/assets/baked/nalati-grasslands/terrain.bin';

/** GR6: Nalati's boot declaration as program discovery, as the retired nalati-boot-metadata bake wrote it into
 *  boot/declaration.generated.ts and boot/explore.generated.json: the budgets, navigation, capture poses, the declared
 *  ground rows and samples, the map palette, the navmesh ground and the boot files, sources, late reads and Explorer art.
 *  The public inventory is listed through `ctx.inputFiles` over the declared roots (`data/bootInventory.json`; recipes read
 *  presence only); the terrain and navigation bytes
 *  come through `ctx.cached`. */
export async function nalatiBootProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<Readonly<Record<string, unknown>>> {
  const list = ctx.inputFiles;
  if (list === undefined) throw new Error('Nalati boot discovery requires the inputFiles capability');
  const listed = Object.fromEntries(list(declared.roots).filter(url => !url.endsWith('.DS_Store')).sort().map((url): [string, true] => [url, true]));
  const inventory = nalatiBootInventory(nalatiBootAssets(), listed);
  const files = await ctx.cached({ id: 'boot-inputs', inputs: [TERRAIN_URL, NALATI_NAVIGATION_INPUT] }, inputs => {
    const terrain = inputs.get(TERRAIN_URL), navigation = inputs.get(NALATI_NAVIGATION_INPUT);
    if (terrain === undefined || navigation === undefined) throw new Error('Missing declared Nalati boot inputs');
    return new Map([['terrain.bin', terrain], ['navigation.bin', navigation]]);
  });
  const terrain = files.get('terrain.bin'), navigationBytes = files.get('navigation.bin');
  if (terrain === undefined || navigationBytes === undefined || files.size !== 2) throw new Error('Missing cached Nalati boot inputs');
  const { heightAt } = readNativeTerrain(terrain), geography = nalatiGeographyRows();
  const { assets: _navigationAssets, ...navigationRows } = nalatiNavigationSource(navigationBytes);
  const explore = discovery.explore;
  return {
    budgets: { ceilings, ...budgetInputs },
    navigation: { navigation: navigationRows.navigation, url: NALATI_NAVIGATION_URL, files: navigationRows.files, critical: navigationRows.critical },
    poses: Object.fromEntries(discovery.captureProbes.map(probe => [probe.name, {
      probe, eye: [probe.x, heightAt(probe.x, probe.z) + 1.68, probe.z],
      // `0 -`, not unary minus: discovery is JSON, which has no -0 (the bridge eye faces yaw 0)
      yaw: 0 - probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
    }])),
    groundRows: geography.ground, groundColourSamples: geography.pigment, surfaceSamples: geography.surface,
    forestMaskSamples: geography.channels.forest, mapGroundSamples: [geography.channels.mapRed, geography.channels.mapGreen, geography.channels.mapBlue],
    mapPalette: geography.map,
    navmesh: { ground: { waterMargin: .25, wet: geography.channels.wet, wetThreshold: .5, trailClearance: 3.5 } },
    'boot.files': inventory.files, 'boot.sources': inventory.sources, 'boot.lateReads': inventory.lateReads,
    'boot.explore': { art: [...Object.values(explore.art), ...discovery.extraArt, ...explore.compare.flatMap(({ live, image }) => [live, image])] },
  };
}
