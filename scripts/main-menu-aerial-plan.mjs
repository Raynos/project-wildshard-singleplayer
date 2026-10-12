// Plain-Node capture launcher; sim-node-loader resolves the existing pure layout.
import { aerialHeroPlan } from './main-menu-aerial-poses.ts';

process.stdout.write(`${JSON.stringify(aerialHeroPlan())}\n`);
