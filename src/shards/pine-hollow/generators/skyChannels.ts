// Pine's keyed sky params as a numeric channel group (SHARD-PLATFORM W2 C2, H4): the two sky graphs' (the dome's and the
// environment pass's) blend, key turns and gains from the keyed sky's own numbers (`keys`), the light direction (the sun by
// day and while the night is under half, else the moon), the aureole's glow (the preset's, faded below the horizon by day
// and under the deck), the deck's grey and its flat colour (the fog's × 1.05), read from the clock owner the graph day sky
// fills (`@wildshard/game/looks/graphDaySky`).
import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import SKY_LOOKS from '../data/skyLook.json' with { type: 'json' };

export const PINE_SKY_CHANNELS = 'pine.sky';
type Expr = NumericChannelOutput['expr'];
const RGB = ['r', 'g', 'b'] as const, XYZ = ['x', 'y', 'z'] as const;
const key = (field: string): Expr => (_b, read) => read('keys', [field]);
/** the light body: the sun by day or while the night is under half, else the moon */
const body = (axis: 'X' | 'Y' | 'Z'): Expr => (b, read) => {
  const sunSide = b.binary('max', read('clock', ['day']), b.binary('gt', b.constant(0.5), read('clock', ['night'])));
  return b.select(sunSide, read('clock', [`sun${axis}`]), read('clock', [`moon${axis}`]));
};
/** the aureole: the preset's glow × (by day, the sun's rise over −0.08 … 0.02) × (1 − the deck) */
const glow = (c: 'r' | 'g' | 'b'): Expr => (b, read) => {
  const rise = b.select(read('clock', ['day']), b.sample(read('clock', ['sunY']), [[-0.08, 0], [0.02, 1]], 'smoothstep'), b.constant(1));
  return b.binary('mul', read('preset', ['glow', c]), b.binary('mul', rise, b.binary('sub', b.constant(1), read('keys', ['overcast']))));
};
const params: readonly (readonly [string, Expr])[] = [
  ['mix', key('mix')], ['gainA', key('gainA')], ['gainB', key('gainB')],
  ['rotA.x', (b, read) => b.unary('cos', read('keys', ['turnA']))], ['rotA.y', (b, read) => b.unary('sin', read('keys', ['turnA']))],
  ['rotB.x', (b, read) => b.unary('cos', read('keys', ['turnB']))], ['rotB.y', (b, read) => b.unary('sin', read('keys', ['turnB']))],
  ...XYZ.map((a, i): readonly [string, Expr] => [`lightDir.${a}`, body((['X', 'Y', 'Z'] as const)[i] ?? 'X')]),
  ...RGB.map((c, i): readonly [string, Expr] => [`glow.${XYZ[i] ?? 'x'}`, glow(c)]),
  ['grey', (b, read) => b.binary('mul', b.constant(0.92), read('keys', ['overcast']))],
  ...RGB.map((c, i): readonly [string, Expr] => [`flat.${XYZ[i] ?? 'x'}`, (b, read) => b.binary('mul', read('fog', ['color', c]), b.constant(1.05))]),
];
const path = (name: string): NumericChannelOutput['path'] => { const [p, a] = name.split('.'); return a === undefined ? [p ?? name] : [p ?? name, a]; };
/** every param into both graphs */
const outputs: NumericChannelOutput[] = [SKY_LOOKS.dome, SKY_LOOKS.env].flatMap(target => params.map(([name, expr]) => ({ target, path: path(name), expr })));

/** the group's programs (build output: data/skyChannels.generated.json) */
export const pineSkyChannels = (): ReturnType<typeof numericChannelPrograms> => numericChannelPrograms(PINE_SKY_CHANNELS, PINE_SKY_CHANNELS, outputs);
