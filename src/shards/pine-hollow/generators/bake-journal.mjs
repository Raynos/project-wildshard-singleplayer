import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as v from 'valibot';
import {nameBlob} from '@wildshard/sdk/blobs';
import {JournalRowSchema,journalRowRules} from '@wildshard/format/compendiumRows';
import {JOURNAL} from './journalContent.ts';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';
import {byteWriter} from '../../../../scripts/bake-output.mjs';

const files=new Map();
const project=new URL('../',import.meta.url), blobs=namedBlobOutput(project,'pine-journal-images','assets/journal');
const image=url=>{
  if(!/^\/assets\/pine-hollow\/journal\/[a-z0-9-]+\.webp$/u.test(url))throw new Error('Unexpected journal image source');
  const bytes=readFileSync(new URL(`../../../../public${url}`,import.meta.url));
  const name=`journal/${url.split('/').at(-1)}`;
  blobs.add(name,'image',bytes,url);
  const {name:_name,path:_path,...file}=nameBlob(name,'image',bytes).file;files.set(file.hash,file);
  return createHash('sha256').update(bytes).digest('hex');
};
for(const file of readdirSync(new URL('../../../../public/assets/pine-hollow/journal/',import.meta.url)).sort()) {
  if(file.endsWith('.webp'))image(`/assets/pine-hollow/journal/${file}`);
}
const row=v.parse(JournalRowSchema,{...JOURNAL,chalk:{...JOURNAL.chalk,atlas:image(JOURNAL.chalk.atlas)},
  entries:JOURNAL.entries.map(entry=>{
    const value=structuredClone(entry);value.plate.sketch=image(entry.plate.sketch);
    if(entry.kind!=='place')value.plate.silhouette=image(entry.plate.sketch.replace(/\.webp$/u,'-sil.webp'));
    return value;
  })});
const errors=journalRowRules(row);if(errors.length>0)throw new Error(errors.join(', '));
blobs.finish(new URL('../data/journalBlobs.generated.json',import.meta.url));
const writer=byteWriter(process.argv.includes('--check'),'pine-journal');
writer.put(fileURLToPath(new URL('../data/journal.generated.json',import.meta.url)),`${JSON.stringify({row,files:[...files.values()].sort((a,b)=>a.hash.localeCompare(b.hash))})}\n`);
writer.finish();
