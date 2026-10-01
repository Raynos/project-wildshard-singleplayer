export interface AssetReport { checked: number; missing: { url: string; from: string; closest: string | null }[] }
export function checkAssetCase(root: string): AssetReport;
