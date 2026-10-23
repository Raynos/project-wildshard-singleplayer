export interface StageRequest {
  root: string;
  job: string;
  inputs: { file: string; source: string; hash: string }[];
}
/** Worker copies with optional filesystem clones, then verifies every input byte. */
export function stageGenerationInputs(request: StageRequest): Promise<string>;
