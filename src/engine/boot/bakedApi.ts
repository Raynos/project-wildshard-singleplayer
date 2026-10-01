/** Fetch after level selection; the public data API must not load the content registry. */
export async function preloadBakedTextures(): Promise<number> {
  return (await import('./bakedTextures')).preloadBakedTextures();
}
