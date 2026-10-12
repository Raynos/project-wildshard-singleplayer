// Plain-Node capture launcher; sim-node-loader resolves the existing pure layout.
//   node --import scripts/sim-node-loader.mjs scripts/main-menu-aerial-plan.mjs [aerial|landscape]
import { aerialHeroPlan, landscapeHeroPlan } from './main-menu-aerial-poses.ts';

const round = process.argv[2] ?? 'aerial';
if (round !== 'aerial' && round !== 'landscape') throw new Error('Plan round must be aerial or landscape');
process.stdout.write(`${JSON.stringify(round === 'landscape' ? landscapeHeroPlan() : aerialHeroPlan())}\n`);
