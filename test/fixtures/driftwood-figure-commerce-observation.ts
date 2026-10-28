import { FIGURE_CATALOGUE } from '../../src/shards/driftwood-isle/generators/figureCatalogue';
import { driftwoodQuestFigures } from '../../src/shards/driftwood-isle/generators/questFigures';
import { driftwoodKitFigureCards } from '../../src/shards/driftwood-isle/generators/kitFigureCards';
import { driftwoodCatalogueEconomy } from '../../src/shards/driftwood-isle/generators/catalogueEconomy';
import { TRADER_STALL } from '../../src/shards/driftwood-isle/generators/questShop';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Complete original figure/card and trade-policy wires before contextual product assembly. */
export function driftwoodFigureCommerceObservation() {
  const rows = { figures: FIGURE_CATALOGUE, quest: driftwoodQuestFigures(), cards: driftwoodKitFigureCards(),
    economy: driftwoodCatalogueEconomy(), trader: TRADER_STALL };
  return Object.entries(rows).map(([name, row]) => { const bytes = new TextEncoder().encode(JSON.stringify(row));
    return { name, bytes: bytes.length, hash: hashImmutableBytes(bytes) }; });
}
