// The pilot composition: new plots supply their own builder set and construction hooks.
import { Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { tiledPlotWorldBytes } from './tiledPlotCore.mjs';
import { nightMarketPlot } from './nightMarket.mjs';

export function tiledWorldBytes(read, tools, idea) {
  return tiledPlotWorldBytes(read, tools, idea, nightMarketPlot, { Document, WebIO, ALL_EXTENSIONS, MeshoptDecoder });
}
