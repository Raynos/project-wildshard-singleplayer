import { heldGraphFiles } from './heldGraphFiles';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import { parseGraphArms } from '@wildshard/format/graphArmsRows';
import profile from '../data/heldProfile.generated.json' with { type: 'json' };
import pendants from '../data/heldPendants.json' with { type: 'json' };
import arms from '../data/arms.json' with { type: 'json' };

const { ARMS, ARMS_BASE, ARMS_MAPS } = arms;
const TRAIL = 'nine-vm-trail', EDGE = 'nine-vm-edge';

/** The held arms as one GraphArms row (runtime/viewmodel/graphArms.ts); runtime code never imports authoring JSON. */
export function heldView(): Readonly<Record<string, unknown>> {
  const scene = parsePrivateScene(pendants);
  const materials = pendants.materials.map(row => row.source);
  const looks = [...new Set([...profile.meshes.map(row => row.look), ...materials, TRAIL])];
  return parseGraphArms({
    rig: { url: `${ARMS_BASE}fp-rig.glb`, skeleton: 'nine-dragon-fp', sockets: [ARMS.weapon, ARMS.claw],
      joints: ['R', 'L'].map(side => ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'].map(joint => `${side}_${joint}`)),
      holdRight: ARMS.holdRight, holdLeft: ARMS.holdLeft, walkRate: ARMS.walkRate, lag: ARMS.lag },
    blade: { socket: ARMS.weapon, base: ARMS.bladeBase, tip: ARMS.bladeTip },
    trail: { look: TRAIL, seed: 'seed', samples: 28, subdivisions: 4, movementSq: 1e-6, life: ARMS.trail.life, total: ARMS.trail.total, from: ARMS.trail.from, order: 5 },
    claw: ARMS.claw, params: heldGraphFiles.params,
    meshes: profile.meshes.map(({ name, look, channels, hull, doubleSide, maps }) => maps === '' ? { name, look, channels, hull, doubleSide } : { name, look, channels, hull, doubleSide, maps }),
    maps: { base: ARMS_BASE, names: ARMS_MAPS, kinds: { maps: 'uMapsTex', nrm: 'uNrmTex' }, anisotropy: 4 },
    weave: { file: 'looks/plain-weave.r8', size: 256, param: 'uSilk' },
    decal: { files: { phone: 'looks/jian-decal-phone.png', desktop: 'looks/jian-decal-desktop.png' }, param: 'uDecal' },
    back: looks.filter(id => id.includes('hull')), additive: [EDGE, TRAIL],
    pendants: { socket: ARMS.weapon, scene, materials,
      geometry: [{ file: 'weapons/jian-cloth.json' }, { file: 'weapons/jian-halo.json', field: 'geometry', name: 'edge' }] },
    // the look's clock, the drawing buffer, the line widths in buffer pixels and the held camera's projection
    frame: [{ param: 'uTime', source: 'time' }, { look: EDGE, param: 'time', source: 'time' },
      { param: 'uRes', source: 'buffer' }, { param: 'uLinePx', source: 'pixels', scale: 0.8, min: 1 }, { param: 'uHullPx', source: 'pixels', scale: 1.2, min: 1 },
      { look: EDGE, param: 'resolution', source: 'buffer' }, { look: EDGE, param: 'pixels', source: 'pixels', scale: 7 },
      { param: 'projection', source: 'projection' }],
  });
}
