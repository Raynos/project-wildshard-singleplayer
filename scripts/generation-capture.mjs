// Browser capture provenance is distinct from payload. The shared cache still compares every cold/forced byte.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import * as v from 'valibot';

const Header=v.looseObject({version:v.number(),revision:v.string(),build:v.string(),inputs:v.optional(v.record(v.string(),v.string()))});
const Preview=v.strictObject({url:v.string(),revision:v.pipe(v.string(),v.regex(/^[0-9a-f]{40}$/u))});
const Version=v.object({build:v.string()});

/** Compare captured gameplay data exactly, excluding only declared source/build provenance at the top level.
 * No nested field, actor clock or collider value is removed. @param {string} text */
export function captureOutcome(text) {
  const {revision:_revision,build:_build,inputs:_inputs,...payload}=v.parse(Header,JSON.parse(text));
  return JSON.stringify(payload);
}

/** Exact executable identity for page captures and standalone Chromium generators. */
export function generationBrowserDigest() { return createHash('sha256').update(readFileSync(chromium.executablePath())).digest('hex'); }

/** Read and fence a pinned preview's build; the producer already enforces the same revision in its own capture.
 * @param {{url:string,revision:string}} spec */
export async function capturePreview(spec) {
  const preview=v.parse(Preview,spec),url=new URL('/version.json',preview.url);
  if(url.protocol!=='http:' && url.protocol!=='https:') throw new Error('Invalid capture preview protocol');
  const response=await fetch(url);
  if(!response.ok) throw new Error(`Capture preview unavailable: ${String(response.status)}`);
  const {build}=v.parse(Version,await response.json());
  if(!build.startsWith(`${preview.revision.slice(0,7)}-`)) throw new Error(`Capture preview revision mismatch: ${build}`);
  const browserDigest=generationBrowserDigest();
  return {url:preview.url,revision:preview.revision,build,browserDigest};
}
