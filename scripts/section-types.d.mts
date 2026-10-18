import type { FormatJsonSchema } from '../src/sdk/formatJsonSchema';
/** Emit a standalone TypeScript value type from a structural output schema. */
export function sectionType(schema: FormatJsonSchema | boolean): string;
