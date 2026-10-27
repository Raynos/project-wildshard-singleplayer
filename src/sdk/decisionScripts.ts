import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { parseReturnProjectionV2 as parseProjection, type ReturnProjectionV2Rows as Projection } from '@wildshard/format/returnProjectionV2';
import { parseDecisionScripts as parse, type DecisionScriptRow as Row } from '@wildshard/format/decisionScripts';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';

/** Version stamps for source-owned projection metadata; no compiler is loaded. */
export function scriptV2Revisions(): typeof SCRIPT_V2_REVISIONS { return SCRIPT_V2_REVISIONS; }

/** Admitted decision-script metadata, independent of source readers and compilation services. */
export type DecisionScriptRow = Row;
/** Admit bounded script metadata with the unchanged runtime contract; no source file is read or compiled. */
export function parseDecisionScripts(input: unknown): readonly Row[] { return parse(input); }

/** Strict numeric projection metadata, with no compiler or filesystem dependency. */
export type ReturnProjectionV2Rows = Projection;
/** Admit cached or authored projection metadata through the runtime's complete contract. */
export function parseReturnProjectionV2(input: unknown): ReturnProjectionV2Rows { return parseProjection(input); }

/** Version stamps for source-owned projection metadata; no compiler is loaded. */
export function scriptV2Revisions(): typeof SCRIPT_V2_REVISIONS { return SCRIPT_V2_REVISIONS; }
