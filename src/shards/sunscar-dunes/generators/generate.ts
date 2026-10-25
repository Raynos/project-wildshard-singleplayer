import type { GeneratedProject } from '@wildshard/sdk/projectGeneration';
import { signalProductRows } from './product';
import { output } from './sourceOutput';

/** Build the original declaration and output together from their defining source functions. */
export function generate(): GeneratedProject {
  return { shard: signalProductRows(), output };
}
