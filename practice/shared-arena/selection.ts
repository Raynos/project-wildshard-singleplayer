const aliases: Readonly<Record<string, string>> = {
  mantis: 'splinter-mantis', 'splinter-mantis': 'splinter-mantis',
  conch: 'conch-duelist', 'conch-duelist': 'conch-duelist',
  colossus: 'tideRootColossus', tideRootColossus: 'tideRootColossus', 'tide-root-colossus': 'tideRootColossus',
  puffer: 'brine-puffer', 'brine-puffer': 'brine-puffer',
  bellback: 'bellback',
  pitcher: 'brine-pitcher-matriarch', matriarch: 'brine-pitcher-matriarch', 'brine-pitcher-matriarch': 'brine-pitcher-matriarch',
  medusa: 'pearlglass-medusa', 'pearlglass-medusa': 'pearlglass-medusa',
  keelmaw: 'keelmaw',
  iguana: 'bloomthroat-iguana', 'bloomthroat-iguana': 'bloomthroat-iguana',
};

/** Initial selection only. Explicit query keys precede the legacy bare hash; unknown input keeps the default. */
export function arenaUrlOpponent(search: string, hash: string): string | undefined {
  const params = new URLSearchParams(search);
  let value = params.get('opponent') ?? params.get('enemy');
  if (value === null) {
    try { value = decodeURIComponent(hash.startsWith('#') ? hash.slice(1) : hash); }
    catch { return undefined; }
  }
  return Object.hasOwn(aliases, value) ? aliases[value] : undefined;
}
