// Exact compressed packet oracle, no browser / decoder / PCM allocation.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { indexAac } from '../../../src/engine/audio/aacIndex.ts';
const [out] = process.argv.slice(2);
if (!out) throw new Error('Pass OUT_JSON');
const results = [];
for (const genre of ['piano', 'folk', 'orchestral']) {
  const spec = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8')).slots.title;
  const path = `public/assets/music/${genre}/${spec.full}`, bytes = readFileSync(path), index = indexAac(bytes);
  const packets = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_packets', '-show_entries',
    'packet=pts,duration,size,pos,side_data_list', '-of', 'json', path], { encoding: 'utf8' })).packets;
  let mismatch;
  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    if (index.offsets[i] !== Number(p.pos) || index.sizes[i] !== Number(p.size)
      || i * 1024 - index.primingFrames !== p.pts) { mismatch = i; break; }
  }
  const skip = packets[0].side_data_list?.find(v => v.side_data_type === 'Skip Samples')?.skip_samples;
  const exact = mismatch === undefined && index.sizes.length === packets.length && skip === index.primingFrames;
  results.push({ genre, path, sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    packets: index.sizes.length, primingFrames: index.primingFrames, mediaFrames: index.mediaFrames,
    metadataBytes: index.offsets.byteLength + index.sizes.byteLength + index.description.byteLength,
    description: [...index.description], exact, mismatch });
}
const report = { protocol: 'Pure bounded reader versus ffprobe on every compressed packet offset, size, presentation timestamp and priming edit. No native decoded memory saving claim.', results };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
if (results.some(result => !result.exact)) throw new Error('Packet oracle mismatch');
