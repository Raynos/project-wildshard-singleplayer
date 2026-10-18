/** Explore may already own the view before shader compilation and the loader fade finish. */
export function finishedBootState(exploring: boolean, entered: boolean): 'explore' | 'play' | 'title' {
  return exploring ? 'explore' : entered ? 'play' : 'title';
}
