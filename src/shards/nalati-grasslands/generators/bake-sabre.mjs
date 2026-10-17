import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MeshBasicMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { buildSabre, SABRE_MOVES, PASS_LEFT, PASS_RIGHT } from './sabre.ts';

const material = new MeshBasicMaterial(), rig = buildSabre(material, material);
const parts = [['sword', rig.sword], ['arms', rig.arms], ['steel', rig.extras[0].geometry]];
const glb = staticGlb(parts.map(([name, geometry]) => ({ name, geometry, material, compactIndex: true,
  extras: { restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]), restBox: null, restSphere: null } })), 'nalati-sabre');
const hash = createHash('sha256').update(glb).digest('hex');
const key = ({ t, pos, q }) => ({ t, pos: pos.toArray(), q: q.toArray() });
const move = row => ({ ...row, keys: row.keys.map(key), trail: { ...row.trail, color: row.trail.color.toArray() } });
const rows = { pool: { url: `/assets/nalati/baked/${hash}.glb`, parts: parts.map(([name]) => name) },
  blade: { length: 0.62, curve: 0.12 }, rig: { tipY: rig.tipY, baseY: rig.baseY, tipX: rig.tipX },
  moves: { rest: key(SABRE_MOVES.rest), charge: key(SABRE_MOVES.charge), sprint: key(SABRE_MOVES.sprint),
    combo: SABRE_MOVES.combo.map(move), heavy: move(SABRE_MOVES.heavy), passes: { left: move(PASS_LEFT), right: move(PASS_RIGHT) } } };
const writer = byteWriter(process.argv.includes('--check'), 'sabre');
writer.put(fileURLToPath(new URL(`../../../../public/assets/nalati/baked/${hash}.glb`, import.meta.url)), glb);
writer.put(fileURLToPath(new URL('../data/sabre.generated.json', import.meta.url)), encodeCanonicalJson(rows));
writer.finish();
for (const [, geometry] of parts) geometry.dispose();
material.dispose();
