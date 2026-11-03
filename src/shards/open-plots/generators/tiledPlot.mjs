// The pilot composition: new plots supply their own builder set and construction hooks.
import { Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { tiledPlotWorldBytes } from './tiledPlotCore.mjs';
import { nightMarketPlot } from './nightMarket.mjs';
import { lanternBayouPlot } from './bayou.mjs';
import { scaffoldPlot } from './scaffold.mjs';
import { frostlinePlot } from './frost.mjs';
import { mosslightPlot } from './mosslight.mjs';

export const plotBuilders = { 'night-market': nightMarketPlot, 'lantern-bayou': lanternBayouPlot, 'frostline-peaks': frostlinePlot, 'mosslight-ruins': mosslightPlot, scaffold: scaffoldPlot };

/** Select a plot's own construction hooks; missing `plot` preserves existing Night Market bytes.
 * A Frostline tower may specify its sheave height after its three coordinates. */
export function plotForLayout(layout, scaffold = false) {
  const name = layout.plot ?? 'night-market';
  if (!Object.hasOwn(plotBuilders, name)) throw new Error('open-plots: unknown layout plot builder');
  if (!scaffold && (layout.landmark === null || layout.posters === null)) throw new Error('open-plots: only scaffolds may omit landmark or posters');
  const lift = layout.landmark?.lift;
  if (lift !== undefined) {
    const point = (row, min, max) => Array.isArray(row) && row.length >= min && row.length <= max && row.every(Number.isFinite);
    if (!Array.isArray(lift.stations) || lift.stations.length !== 2 || !lift.stations.every(row => point(row, 3, 3))
      || !Array.isArray(lift.towers) || !lift.towers.every(row => point(row, 3, 4) && (row.length === 3 || row[3] > 0))
      || (lift.chairs !== undefined && (!Number.isSafeInteger(lift.chairs) || lift.chairs < 0))) throw new Error('open-plots: invalid lift coordinates');
  }
  return plotBuilders[name];
}

export function tiledWorldBytes(read, tools, idea) {
  const layout = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(`src/shards/open-plots/data/layouts/${idea.layout}.json`)));
  const plot = plotForLayout(layout, idea.scaffold === true);
  return tiledPlotWorldBytes(read, tools, idea, plot, { Document, WebIO, ALL_EXTENSIONS, MeshoptDecoder });
}
