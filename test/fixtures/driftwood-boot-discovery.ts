// oxlint-disable-next-line import/no-nodejs-modules -- Bind the source operation to its real public input root.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { driftwoodBootProgram } from '../../src/shards/driftwood-isle/generators/bootProgram';
import { driftwoodNavigation } from '../../src/shards/driftwood-isle/generators/navigation';
import { driftwoodGroundDeclaration } from '../../src/shards/driftwood-isle/generators/groundDeclaration';

const context = createProjectGeneration(resolve('src/shards/driftwood-isle'), 'f'.repeat(64), new Map(),
  resolve('tmp/driftwood-boot-inventory'), [{ prefix: '/assets/', directory: resolve('public/assets') }]);
/** The real bounded discovery operations, without a complete product rebuild. */
export const discovery = { 'ground.rows': driftwoodGroundDeclaration(), navigation: await driftwoodNavigation(context),
  ...driftwoodBootProgram(context) };
