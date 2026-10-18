import { WorldSceneSurfaceSchema } from '@wildshard/format/worldSceneSurface';
import * as v from 'valibot';
import { CABIN_PBR, CABIN_MATERIALS, CABIN_GLASS_EMISSIVE } from './cabinAssembly';
import { CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS } from './cabinLook';

const caps = { cellTexture: { atMost: 1024, max: 512 } };
const look = { roof: CABIN_MOSS_LOOKS.roof, stone: CABIN_MOSS_LOOKS.stone, door: CABIN_DOOR_LOOK };
/** These are the homestead's original surfaces; the buildings and timber borrow the same identities. */
const rows: unknown[] = [];
for (const row of CABIN_PBR) rows.push({ id: `timber.${row.key}`, kind: 'surface', ...caps, scan: row.scan,
    properties: { metalness: 0, color: [...row.color], normalScale: [...row.normal] },
    ...((row.key === 'roof' || row.key === 'stone' || row.key === 'door') ? { look: look[row.key],
      ...(row.key === 'door' ? {} : { lookTextures: { normalMap: 'normalMap' } }) } : {}) });
for (const [key, properties] of Object.entries(CABIN_MATERIALS)) rows.push({ id: `timber.${key}`, kind: 'surface', properties: {
    ...properties, ...(key === 'glass' ? { emissive: [...CABIN_GLASS_EMISSIVE] } : {}) },
    ...(key === 'endGrain' ? { map: { appearance: 'look/cover-appearance.json', texture: 'endGrain' } } : {}) });
const parsed = rows.map(row => v.parse(WorldSceneSurfaceSchema, row));
// Native publication order also fixes the material sort at coplanar joins.
export const TIMBER_MATERIALS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'glass', 'bark', 'iron', 'cloth', 'char'].map(key => {
  const row = parsed.find(surface => surface.id === `timber.${key}`);
  if (row === undefined) throw new Error(`Missing timber surface: ${key}`);
  return row;
});
