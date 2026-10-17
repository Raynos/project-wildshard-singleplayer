export declare const RULER_JSON: string;
export declare const PORT_SHARES_JSON: string;
/** the committed table's exact text for one ruler.json body */
export declare function portSharesText(rulerText: string): string;
/** null when the table matches what the ruler implies, else the reason and the fix */
export declare function portSharesMismatch(rulerText: string | undefined, sharesText: string | undefined): string | null;
/** rewrite src/game/shard/portShares.json from ruler.json; returns the text */
export declare function writePortShares(root?: string): string;
