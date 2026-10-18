import { Color } from 'three';
import type { SkyRows, SkySchema } from '../data/skyTypes';
import { NALATI_MANIFEST_ROWS } from './manifestRows';
import { visualChannel } from './weatherFxChannels';
import type { ClientChannelProgram } from '@wildshard/format/clientChannels';

/** Numeric day keys and their live-preset field layout, built before admission. */
export function skyRows(): SkyRows {
 const {sky:S,grade:G,atmosphere:A}=NALATI_MANIFEST_ROWS,P=S.painted,vs=A.volumetric.strength;
 const rgbOf=(c:Color):[number,number,number]=>[c.r,c.g,c.b];
 const day: SkyRows['day'] = {
      el: 14,
      // the def's own light, as SkyRig.build starts it (standalone the live values are these at this point): inside a grid
      // cell the shared sky is still the road's when the region builds (SF63: the cell lit with the road's key, fill and
      // environment read paler and flatter than standalone)
      sun: S.sunColor, sunI: S.sunIntensity,
      zenith: P.zenith, horizon: P.horizon, ground: P.ground, glow: P.glow, stars: 0,
      hemiSky: rgbOf(new Color(S.hemiSky)), hemiGround: rgbOf(new Color(S.hemiGround)), hemiI: S.hemiIntensity, env: S.envIntensity,
      fog: P.horizon, fogSun: S.fogSunColor,
      shade: [.1,.14,.3], rim: [1.4,1.2,.9],
      cloudSun: S.cloudSunColor, cloud: [1, 1, 1], planet: [1, 1, 1],
      shadowTint: G.shadowTint, highTint: G.highTint, lift: G.lift, gain: G.gain, sat: G.saturation, contrast: G.contrast,
      vol: A.volumetricSunColor, volS: vs, rays: 1,
    };
 const initial:SkyRows['initial'] = {
    keyColor: [0,0,0], keyIntensity: 1, moon: 0, disc: 1,
    zenith: [0,0,0], horizon: [0,0,0], ground: [0,0,0], glow: [0,0,0], stars: 0,
    hemiSky: [0,0,0], hemiGround: [0,0,0], hemiIntensity: 0.5, envIntensity: 1,
    fogColor: [0,0,0], fogSunColor: [0,0,0], fogDist: 0.0003, fogHeightDensity: 0.0006,
    shadeTint: [0,0,0], rimColor: [0,0,0],
    cloudSun: [0,0,0], cloudLight: [1,1,1], planetLight: [1,1,1], planetOpacity: 1,
    shadowTint: [0,0,0], highTint: [0,0,0], lift: [0,0,0], gain: [0,0,0], saturation: 0, contrast: 0, brightness: 0,
    volColor: [0,0,0], volStrength: 0.35, godRays: 1,
  };
 const schema=Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,typeof value==='number'?'number':'colour'])) as SkySchema;
 return {day,initial,schema};
}

/** The day-key projection and the dome bindings are ordinary client channels. */
export function skyChannels(): ClientChannelProgram[] {
 const rows:ClientChannelProgram[]=[];
 const sample=(path:string,expression:string):void=>{rows.push(visualChannel('look',path,expression,`nalati.sky.sample.${String(rows.length)}`,'nalati.sky.sample'));};
 const sun='(clock.elevation > -1.5)',moon='ss(-2,-12,clock.elevation)';
 sample('moon',`${sun} ? 0 : 1`);sample('disc',`${sun} ? ss(-2.5,.5,clock.elevation) : ${moon}`);
 sample('keyIntensity',`${sun} ? key.sunI*ss(-1.5,1.5,clock.elevation) : .95*${moon}`);
 for(const [field,to] of [['stars','stars'],['hemiI','hemiIntensity'],['env','envIntensity'],['sat','saturation'],['contrast','contrast'],['volS','volStrength'],['rays','godRays']] as const)sample(to,`key.${field}`);
 const colours={zenith:'zenith',horizon:'horizon',ground:'ground',glow:'glow',hemiSky:'hemiSky',hemiGround:'hemiGround',fog:'fogColor',fogSun:'fogSunColor',shade:'shadeTint',rim:'rimColor',cloudSun:'cloudSun',cloud:'cloudLight',planet:'planetLight',shadowTint:'shadowTint',highTint:'highTint',lift:'lift',gain:'gain',vol:'volColor'};
 for(const [from,to] of Object.entries(colours))for(const [i,axis] of ['r','g','b'].entries())sample(`${to}.${axis}`,`key.${from}[${String(i)}]`);
 for(const [i,axis] of ['r','g','b'].entries())sample(`keyColor.${axis}`,`${sun} ? key.sun[${String(i)}] : ${String([.62,.74,1][i])}`);
 for(const field of ['fogDist','fogHeightDensity','brightness'])sample(field,`base.${field}`);
 sample('planetOpacity','1');
 const dome=(path:string,expr:string):void=>{rows.push(visualChannel('nalati-sky-dome',path,expr,`nalati.sky.dome.${String(rows.length)}`,'nalati.sky.dome'));};
 for(const field of ['zenith','horizon','ground','glow'])for(const [axis,c] of [['x','r'],['y','g'],['z','b']])dome(`${field}.${axis}`,`look.${field}.${c}`);
 for(const axis of ['x','y','z']){dome(`sunDir.${axis}`,`look.sunDir.${axis}`);dome(`moonDir.${axis}`,`look.keyDir.${axis}`);}
 dome('moon','look.moon*look.disc');dome('stars','look.stars');dome('flash','flash');
 return rows;
}
