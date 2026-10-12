// Plain-Node capture launcher; sim-node-loader resolves the existing pure layout.
//   node --import scripts/sim-node-loader.mjs scripts/main-menu-aerial-plan.mjs [aerial|landscape|square]
import { aerialHeroPlan, landscapeHeroPlan, squareHeroPlan } from './main-menu-aerial-poses.ts';

const round = process.argv[2] ?? 'aerial';
const plans = { aerial: aerialHeroPlan, landscape: landscapeHeroPlan, square: squareHeroPlan };
if (!Object.hasOwn(plans, round)) throw new Error('Plan round must be aerial, landscape or square');
process.stdout.write(`${JSON.stringify(plans[round]())}\n`);
