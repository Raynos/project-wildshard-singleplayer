// Plain-Node capture launcher; sim-node-loader resolves the existing pure layout.
//   node --import scripts/sim-node-loader.mjs scripts/main-menu-aerial-plan.mjs [aerial|landscape|square|4|5]
import { aerialHeroPlan, landscapeHeroPlan, round4HeroPlan, round5HeroPlan, squareHeroPlan } from './main-menu-aerial-poses.ts';

const round = process.argv[2] ?? 'aerial';
const plans = { aerial: aerialHeroPlan, landscape: landscapeHeroPlan, square: squareHeroPlan, 4: round4HeroPlan, 5: round5HeroPlan };
if (!Object.hasOwn(plans, round)) throw new Error('Plan round must be aerial, landscape, square, 4 or 5');
process.stdout.write(`${JSON.stringify(plans[round]())}\n`);
