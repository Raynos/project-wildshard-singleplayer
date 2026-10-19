/** Stream every encoded frame into bounded full-portrait sheets; original movie stays authoritative. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyMotion5CaptureIdentity, hash } from './qa-conch-motion5-identity.mjs';

const identityBefore=verifyMotion5CaptureIdentity();
const directory=process.argv.at(2);
if (!directory) throw new Error('Supply completed motion5 capture directory');
const report=JSON.parse(readFileSync(join(directory,'report.json')));
if (JSON.stringify(report.identityBefore)!==JSON.stringify(identityBefore) || JSON.stringify(report.identityAfter)!==JSON.stringify(identityBefore)) throw new Error('Capture identity failed or changed');
const video=resolve(report.videoPath);
if(hash(readFileSync(video))!==report.videoSha256) throw new Error('Video changed');
const output=join(directory,'streamed-frame-review');mkdirSync(output); // Refuse overwriting an earlier review.
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time,pkt_duration_time,width,height','-of','json',video],{encoding:'utf8',maxBuffer:64*1024*1024}));
// ffmpeg retains at most one 48-frame thumbnail tile, never a full-frame disk cache.
execFileSync('ffmpeg',['-v','error','-i',video,'-vf','scale=100:218,tile=8x6','-fps_mode','passthrough','-q:v','5','-start_number','0',join(output,'sheet-%06d.jpg')],{stdio:'inherit'});
const files=readdirSync(output).filter(file=>file.endsWith('.jpg')).sort((a,b)=>a.localeCompare(b));
if(files.length!==Math.ceil(probe.frames.length/48)) throw new Error('Streamed sheet count differs from encoded frame coverage');
const sheets=files.map((file,index)=>({file,firstFrame:index*48,lastFrame:Math.min((index+1)*48,probe.frames.length)-1,bytes:statSync(join(output,file)).size,sha256:hash(readFileSync(join(output,file)))}));
const identityAfter=verifyMotion5CaptureIdentity();
if(JSON.stringify(identityBefore)!==JSON.stringify(identityAfter)) throw new Error('Identity changed while decoding');
writeFileSync(join(output,'index.json'),JSON.stringify({schema:'wildshard.conch.motion5.encoded-frame-review.v1',videoSha256:report.videoSha256,identityBefore,identityAfter,encodedFrames:probe.frames,sheets,retainedSheetBytes:sheets.reduce((sum,row)=>sum+row.bytes,0),humanInspectionComplete:false,note:'Every complete portrait encoded frame including duplicates/loading appears in row-major 8x6 sheets, 100x218 thumbnails. Last sheet may contain blank padding beyond lastFrame. Actual PTS retained, not inferred FPS; engine render frames differ. Inspect full detail from the original movie on demand without a disk frame cache. No quality acceptance.'}),{flag:'wx'});
