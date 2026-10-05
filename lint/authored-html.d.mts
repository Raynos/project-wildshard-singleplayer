export interface AuthoredHtmlSite { line: number; column: number; message: string }
export function authoredHtmlSites(root: string, filename: string): AuthoredHtmlSite[];
