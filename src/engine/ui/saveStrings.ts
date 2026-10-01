/** Engine-owned Save screen strings. */
export const SAVE_STRINGS = {
  title: 'SAVE', export: 'EXPORT', import: 'IMPORT', aside: 'SET ASIDE', reload: 'RELOAD TO APPLY',
  note: 'Export your progress as a file, or import a saved file.',
  imported: (n: number): string => `Imported ${n} keys.`,
  skipped: (n: number): string => `Skipped ${n} keys.`,
  failed: 'Could not read the save file.',
} as const;
