import page from '../data/questPageComposition.json' with { type: 'json' };

/** H9 init bytes retain the original rope-deck law's exact parameter order. */
export function driftwoodBridgeSway(): {
  piece: string; system: string; before: string[];
  parameters: [number, number, number, number, number, number, number, number, number];
} {
  const row = page.sway;
  return { piece: row.piece, system: page.systems.sway, before: [...page.systems.before],
    parameters: [row.height, row.ease, row.threshold, row.rate, row.speed, row.rollHz, row.roll, row.dipHz, row.dip] };
}
