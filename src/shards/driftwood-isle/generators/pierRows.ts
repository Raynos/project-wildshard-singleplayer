import authored from './pierRows.json' with { type: 'json' };

function pair(values: readonly number[]): [number, number] {
  const [x, z] = values;
  if (values.length !== 2 || x === undefined || z === undefined || !Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Authored pier requires coordinate pairs');
  return [x, z];
}

/** Original wind, defaults and variants; no source value is replaced or defaulted. */
export const PIER_ROWS = { PENNANT_WIND: pair(authored.PENNANT_WIND),
  PIER_DEFAULTS: { ...authored.PIER_DEFAULTS, pennantDir: pair(authored.PIER_DEFAULTS.pennantDir) },
  PIER_VARIANTS: authored.PIER_VARIANTS.map(row => {
    const { landing, ...rest } = row.params;
    return { id: row.id, label: row.label, params: landing === undefined ? rest : { ...rest, landing: { ...landing, postGround: pair(landing.postGround) } } };
  }),
};
