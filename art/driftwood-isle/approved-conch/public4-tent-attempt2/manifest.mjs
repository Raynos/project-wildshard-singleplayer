/** Conservative byte closure. No build or pin creation during source checks. */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIRECTORY, ORIGINAL, PREVIEW, REVIEW, admitPublic4, inventory, hash, canonical, same } from './admission.mjs';
import { runtimeSourceComparison } from './runtime-scope.mjs';
import { installedInventory } from '../tent-shadow-diagnostic/manifest.mjs';
import { inventory as sourceInventory } from '../selected-native-color-view/build.mjs';
export const CHROME='tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell';
export function closure() {
 admitPublic4();
 const binding=readFileSync(resolve(ROOT,'node_modules/three/src/objects/SkinnedMesh.js'),'utf8');
 if(!/if \( this.bindMode === AttachedBindMode \) \{\s*this\.bindMatrixInverse\.copy\( this\.matrixWorld \)\.invert\(\);/u.test(binding))throw new Error('Installed attached-binding contract changed');
 same(runtimeSourceComparison(),JSON.parse(readFileSync(resolve(ROOT,DIRECTORY,'runtime-source-comparison.json'))));
 const source={};
 for(const directory of ['src','vite','lint',DIRECTORY,'art/driftwood-isle/approved-conch/runtime-admission','art/driftwood-isle/approved-conch/tent-shadow-diagnostic','art/driftwood-isle/approved-conch/selected-native-color-view','art/driftwood-isle/approved-conch/selected-native-color','art/driftwood-isle/approved-conch/selected-native-view','art/driftwood-isle/approved-conch/selected-native-normals','docs/reviews/conch-tent-shadow-independent'])Object.assign(source,sourceInventory(ROOT,directory));
 for(const item of readdirSync(resolve(ROOT,'scripts'),{withFileTypes:true}))if(item.isFile()&&/\.(?:mjs|ts|json|py|sh)$/u.test(item.name))source[`scripts/${item.name}`]=hash(readFileSync(resolve(ROOT,'scripts',item.name)));
 for(const path of [REVIEW,'docs/reviews/conch-tent-playable-candidate.md','practice/shared-arena/pins.json','practice.html','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'])source[path]=hash(readFileSync(resolve(ROOT,path)));
 return {schema:'wildshard.conch.public4-tent.inputs.v1',source,nodeVersion:process.version,nodeExecutableSha256:hash(readFileSync(process.execPath)),mediaTools:{ffprobe:hash(readFileSync('/usr/bin/ffprobe')),ffmpeg:hash(readFileSync('/usr/bin/ffmpeg')),ffprobeVersion:execFileSync('/usr/bin/ffprobe',['-version'],{encoding:'utf8'}),ffmpegVersion:execFileSync('/usr/bin/ffmpeg',['-version'],{encoding:'utf8'})},installed:installedInventory(),browser:inventory(resolve(ROOT,'tmp/dot-audit/tools/chrome-headless-shell-linux64')),browserLaneShimSha256:hash(readFileSync(resolve(ROOT,'tmp/dot-audit/bin/lockf'))),original:inventory(resolve(ROOT,ORIGINAL)),preview:inventory(resolve(ROOT,PREVIEW))};
}
export { hash, canonical, same };
