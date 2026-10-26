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
