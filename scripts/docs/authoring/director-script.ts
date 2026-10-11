import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';
import { generateDirectorAbi } from '@wildshard/sdk/directorAbi';
import { directorsExample } from './directors';

/** Compile an actual boolean accessor over Template 1's declared input ABI, without inventing a handler. */
export async function directorScriptExample() {
  const source = 'import { inputs } from "./wildshard-director";\nexport function ready(): bool { return inputs.doorOpen && !inputs.waveDead; }';
  return compileBehaviourModule(source, 1, { 'wildshard-director.ts': generateDirectorAbi(directorsExample().row) });
}
