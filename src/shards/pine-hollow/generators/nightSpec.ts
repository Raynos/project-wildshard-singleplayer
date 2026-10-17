import { OLD_GROWTH, KINGS_CLEARING, HAMLET_SITES, POND } from '../data/layout';

/** The page's authored old-growth and three millrace placements; tier alone selects the roamer limit. */
export function pineNightSpec(max: 3 | 4): {max:3|4;region:{x:number;z:number;ax:number;az:number};exclude:{x:number;z:number;blend:number};face:{x:number;z:number};mill:{x:number;z:number};water:number;roamKinds:string[];race:{kind:string;x:number;z:number}[]} {
  return { max, region: OLD_GROWTH, exclude: KINGS_CLEARING, face: HAMLET_SITES.wheel,
    mill: HAMLET_SITES.mill, water: POND.level, roamKinds: ['elk', 'boar'],
    race: [{ kind: 'boar', x: -189, z: -134 }, { kind: 'elk', x: -194, z: -148 }, { kind: 'boar', x: -198, z: -160 }] };
}
