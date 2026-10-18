import frames from '../data/peopleFrames.json' with { type: 'json' };
import content from '../data/questContent.json' with { type: 'json' };
import motions from '../data/peopleMotion.json' with { type: 'json' };

const keys = Object.keys(frames);
const atlas = (selection, phone) => ({
  url: `/assets/nalati/baked/people/${selection.length === 1 ? selection[0] : 'camp'}${phone ? '.phone' : ''}.glb`,
  name: 'nalati-camp-people-gen', skeleton: 'npc.figures.v1', columns: 3, rows: 2,
  cell: phone ? 256 : 512, rim: 0.35, bands: 0.8,
  sources: selection.map(id => `/assets/nalati/models/people/${frames[id].file}.gen${phone ? '.phone' : ''}.glb`),
  joints: selection.flatMap(id => ['root', 'head', 'arm'].map(part => `${id}-${part}`)),
});

/** Pose, collider and atlas facts retain the camp's original author order. */
export const peopleRows = {
  name: 'nalati-camp-people', sleep: { figure: 'elder', distance: 90 },
  atlas: { phone: atlas(keys, true), desktop: atlas(keys, false) },
  figures: Object.fromEntries(keys.map((id, index) => {
    const frame = frames[id], spot = content.people[id], motion = structuredClone(motions[id]);
    if (motion.orbit) Object.assign(motion.orbit, { x: spot.x, z: spot.z });
    const x = spot.x + (motion.orbit?.radius ?? 0);
    return [id, { frame, motion, phase: index * 1.7, glanceAfter: 2 + index,
      row: { id: id.toLowerCase(), name: id, feet: [x, 0, spot.z], yaw: spot.yaw, talkHeight: frame.neck[1] + 0.12,
        collider: { kind: 'capsule', y: frame.height / 2, halfHeight: Math.max(0.05, frame.height / 2 - frame.radius), radius: frame.radius },
        rig: { skeleton: 'npc.figures.v1', clips: [], sockets: [] },
        joints: ['root', 'head', 'arm'].map(part => ({ id: `${id.toLowerCase()}.joint.${part}`, source: { part: `${id.toLowerCase()}-${part}` } })),
        sockets: [], visible: [], drawDistance: 90, pointAt: [0, 0, 0], points: false },
      moving: motion.orbit !== undefined,
      atlas: { phone: atlas([id], true), desktop: atlas([id], false) } }];
  })),
  pieces: { still: { id: 'nalati-camp-people', name: 'Camp people', category: 'people', file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh' },
    moving: { id: 'nalati-camp-child', name: 'Camp child', category: 'people', file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh' } },
};
