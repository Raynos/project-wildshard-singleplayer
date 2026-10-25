import catalogue from '../data/campCatalogue.json' with { type: 'json' };
import view from '../data/worldView.json' with { type: 'json' };
import metrics from '../data/modelMetrics.json' with { type: 'json' };
import capture from '../data/staticCapture.json' with { type: 'json' };
import { placeRuntimeRows, type PlaceRuntimeRows } from './placeRuntimeSource.mjs';
import { buildDressingWire } from './dressingProgram';

const inputs = {
  'data/campCatalogue.json': catalogue,
  'data/worldView.json': view,
  'data/modelMetrics.json': metrics,
  'data/staticCapture.json': capture,
};

/** Owning producers supply their computed records; no generated input is imported here. */
export interface NalatiRuntimeInputs {
  readonly places: unknown;
  readonly paint: unknown;
}

/** Combine owned producer records with authored inputs, without a generated runtime handoff.
 * Metadata keeps original JSON wire semantics; each call owns fresh floors and metadata. */
export function nalatiRuntimeRows(computed: NalatiRuntimeInputs): PlaceRuntimeRows {
  const dressing: unknown = JSON.parse(new TextDecoder().decode(buildDressingWire().document));
  const records = { ...inputs, 'data/places.json': computed.places,
    'data/dressingGeos.json': dressing, 'data/poiPaint.json': computed.paint };
  return placeRuntimeRows(name => records[name], value => {
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error('Missing prepared Nalati metadata');
    const normalized: unknown = JSON.parse(text);
    return normalized;
  });
}
