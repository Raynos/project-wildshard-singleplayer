import { fileURLToPath } from 'node:url';
import { AR15 } from './firearmProfile.ts';
import model from '../data/heldRifle.json' with { type: 'json' };
import { parseHeldFirearmRows, parseHeldFirearmView } from '@wildshard/format/weaponProfiles';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';

const view = {
  kick: AR15.kick, port: [0.03, 0.008, 0.0], sight: { muzzleZ: AR15.ads.muzzleZ }, timing: { autoReloadDelay: AR15.autoReload },
  hip: { px: 0.13, py: -0.115, pz: -0.38, rx: 0.03, ry: 0.08, rz: 0.03, scale: 1.0 },
  flash: { frames: 2, lightTime: 0.05, light: 30, size: 0.22 }, brass: AR15.brass, tracer: { count: AR15.tracer.count, time: 0.09 },
};

const rows = parseHeldFirearmRows(model);

const writer = byteWriter(process.argv.includes('--check'), 'nalati-rifle');
writer.put(fileURLToPath(new URL('../data/rifle.generated.json', import.meta.url)), encodeCanonicalJson({
  feel: { kick: AR15.kick, brass: AR15.brass, tracer: AR15.tracer, ads: AR15.ads },
  view: parseHeldFirearmView(view), rows: parseHeldFirearmRows(rows),
}));
writer.finish();
