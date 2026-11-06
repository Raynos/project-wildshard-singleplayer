import type { Plugin } from 'vitest/config';

const seat = '/src/game/client/shardfile/clientMoverOwners.ts';

/** A page's composition root (`src/pageSim.ts`) fills the client's seat on the page sim from the boot bank. A test has no boot,
 * so the seat's module fills itself here: a suite that reaches it gets the graph every page gets, and resetting modules loads a
 * full seat again. The session chunk stays free of the sim because this runs only under Vitest. */
export function vitestPageSeat(): Plugin {
  return {
    name: 'wildshard:vitest-page-seat',
    transform(code, id) {
      const [file = ''] = id.split('?');
      if (!file.endsWith(seat)) return null;
      return { code: `${code}\nimport { pageSimFeed as __testPageSimFeed } from '@wildshard/game/plugin/pageSimFeed';\ninstallPageSim(__testPageSimFeed);\n`, map: null };
    },
  };
}
