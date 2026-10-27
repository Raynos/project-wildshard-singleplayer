/** The deploy stamp is read from the document; it never changes hashed module bytes. */
export const BUILD_ID_EXPRESSION: string;
/** Stamp exactly one document head, refusing missing/duplicate/unsafe identities. */
export function stampBuildHtml(html: string, build: string): string;
/** Stamp all built HTML entries from version.json before service-worker emission. */
export function stampBuildDocuments(directory: string): void;
