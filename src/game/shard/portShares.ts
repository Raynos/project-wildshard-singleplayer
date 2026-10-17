import table from './portShares.json' with { type: 'json' };
/**
 * SHARD SELECT's "N% PORTED" badge (SF65 G238; E486): each legacy shard's ported share (0..1) from the last committed plan
 * ruler run. `portShares.json` beside this file is written by `node scripts/gen-port-shares.mjs` from
 * progress/shard-platform/ruler/ruler.json (ported = 1 − custom % of legacy lines) and committed with it; pre-commit
 * refuses a table that disagrees with the staged ruler. A shard the ruler doesn't measure has no badge.
 */
export const PORT_SHARES: Readonly<Record<string, number>> = table.shares;
/** the ruler run the shares come from (full SHA, ISO time) */
export const PORT_SHARES_RULER: { readonly revision: string; readonly measuredAt: string } = { revision: table.revision, measuredAt: table.measuredAt };
