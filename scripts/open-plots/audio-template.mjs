// Source-only OB2 template packet; positions and native playback belong to OB7.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';

const slug=v.pipe(v.string(),v.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u));
const catalogue=v.parse(v.record(slug,v.pipe(v.array(slug),v.minLength(4),v.check(rows=>new Set(rows).size===rows.length))),
  JSON.parse(readFileSync(new URL('audio-requests.json',import.meta.url),'utf8')));

/** @param {string} idea */
export function plotAudioRequest(idea){
  const spots=catalogue[idea];if(spots===undefined)throw new Error(`No planned audio requests for ${idea}`);
  return {idea,spots:spots.map(id=>({id,at:null}))};
}
