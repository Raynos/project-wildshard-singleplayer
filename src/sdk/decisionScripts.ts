import { parseDecisionScripts as parse, type DecisionScriptRow as Row } from '@wildshard/format/decisionScripts';

/** Admitted decision-script metadata, independent of source readers and compilation services. */
export type DecisionScriptRow = Row;
/** Admit bounded script metadata with the unchanged runtime contract; no source file is read or compiled. */
export function parseDecisionScripts(input: unknown): readonly Row[] { return parse(input); }
