/** Resolve the demo's explicit static assets beside its page, including a mounted /practice/ route. */
export function practiceAssetUrl(path: string, pageUrl: string = document.baseURI): string {
  if (!path.startsWith('/assets/')) throw new Error(`Unexpected practice asset path: ${path}`);
  return new URL(path.slice(1), new URL('.', pageUrl)).href;
}
