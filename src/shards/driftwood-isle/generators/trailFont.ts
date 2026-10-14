/** The trail's authored 5 × 7 block font, compiled to horizontal quad runs at build time. */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
};

/** Cell-space quads retain arbitrary label composition, including gaps for unsupported characters. */
export function trailFontFacts(): Record<string, { start: number; end: number; row: number }[]> {
  return Object.fromEntries(Object.entries(GLYPHS).map(([character, rows]) => {
    const quads: { start: number; end: number; row: number }[] = [];
    for (const [row, cells] of rows.entries()) for (let start = 0; start < 5;) {
      if (cells[start] !== '#') { start++; continue; }
      let end = start; while (end < 5 && cells[end] === '#') end++;
      quads.push({ start, end, row }); start = end;
    }
    return [character, quads];
  }));
}
