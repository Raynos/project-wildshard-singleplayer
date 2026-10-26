import pins from './nalati-model-paint.json' with {type:'json'};

/** Only the two untextured live far-model locations change; every other predecessor value stays exact. */
export function withOwnedModelFiles(input:unknown):unknown{
  if(typeof input==='string'&&input.startsWith('/assets/nalati/baked/painted-models/')){
    const file=input.slice('/assets/nalati/baked/painted-models/'.length);
    if(!['horse-wild.far.glb','kokpar-rider.far.glb'].includes(file))return input;
    const pin=pins.find(row=>row.file===file);if(pin===undefined)throw new Error('Missing original far model pin');
    return{file:`models/painted/${file}`,bytes:pin.bytes};
  }
  if(Array.isArray(input))return input.map(withOwnedModelFiles);
  if(input!==null&&typeof input==='object')return Object.fromEntries(Object.entries(input).map(([key,value]:[string,unknown])=>[key,withOwnedModelFiles(value)]));
  return input;
}

interface PartPin { readonly file: string; readonly geometry: { readonly name: string; readonly compressed: number }; readonly atlas: { readonly name: string; readonly compressed: number } | null }

/** Independent whole-object projection from the frozen wires and fully pinned new payloads. */
export function withPaintedModelParts(input: unknown, parts: readonly PartPin[]): unknown {
  if (Array.isArray(input)) return input.map(value => withPaintedModelParts(value, parts));
  if (input === null || typeof input !== 'object') return input;
  const rows: Record<string, unknown> = Object.fromEntries(Object.entries(input).map(([key, value]: [string, unknown]) => [key, withPaintedModelParts(value, parts)]));
  for (const key of ['url', 'phoneUrl']) {
    const value = rows[key];
    if (typeof value !== 'string' || !value.startsWith('/assets/nalati/baked/painted-models/')) continue;
    const file = value.slice('/assets/nalati/baked/painted-models/'.length), pin = parts.find(row => row.file === file);
    if (pin === undefined) throw new Error(`Missing complete painted model pin: ${file}`);
    rows[key] = { file: pin.geometry.name, bytes: pin.geometry.compressed };
    if (pin.atlas !== null) rows[key === 'url' ? 'atlas' : 'phoneAtlas'] = { file: pin.atlas.name, bytes: pin.atlas.compressed,
      wrapS: 10497, wrapT: 10497, minFilter: 9987, magFilter: 9729, anisotropy: 4, colourSpace: 'srgb' };
  }
  return rows;
}
