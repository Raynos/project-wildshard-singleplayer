// OP3: the shared garden, forecourt and plaza vocabulary without a plot's landmark or theme families.
import { nightMarketBuilders, nightMarketPlot } from './nightMarket.mjs';

export const scaffoldPlot = {
  builders() {
    const shared = nightMarketBuilders();
    return { ...shared, tiles: { ...Object.fromEntries(Object.entries(shared.tiles).filter(([letter]) => ['G', 'N', 'P'].includes(letter))),
      E: { sockets: 'pppp', build: () => undefined, far: () => undefined } } };
  },
  lanternBake: nightMarketPlot.lanternBake,
  models: () => undefined,
  pools: () => undefined,
};
