import { parseDirector } from '@wildshard/format/director';
import { parseDirectorStages, type DirectorStagesData, type DirectorStagesDefinition } from '@wildshard/format/directorStages';

/** Typed director data with bounded observations, payloads and reserved grid subscriptions. */
export type DirectorData = ReturnType<typeof parseDirector>;
/** Validate before admitting a bounded module or installing a fixed-step director. */
export function director(data: unknown): DirectorData { return parseDirector(data); }

/** Author a bounded stage machine. Inputs name native owners; the build emits rows without installing gameplay. */
export class Director {
  private readonly definition: DirectorStagesData;
  constructor(definition: Omit<DirectorStagesDefinition, 'version'>) {
    this.definition = structuredClone(parseDirectorStages({ ...definition, version: 2 }));
  }
  /** Emit independent JSON data, retaining stage and action registration order. */
  toJSON(): DirectorStagesData { return structuredClone(this.definition); }
}
