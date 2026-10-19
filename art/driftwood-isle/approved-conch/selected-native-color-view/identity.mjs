/** Fail-closed identity for new captures; never creates or repairs a build pin. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { admitReviewedBuild, assertCandidatePose, ROOT, DIST, PREVIEW, BUILD_PIN, FREEZE_SHA256 } from './build.mjs';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function exactInventory(root) {
  const files = {};
  const walk = (directory, prefix = '') => {
    if (lstatSync(directory).isSymbolicLink()) throw new Error('Symlink in capture inventory');
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name), key = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in capture inventory: ${key}`);
      if (entry.isDirectory()) walk(path, `${key}/`);
      else if (entry.isFile()) files[key] = hash(readFileSync(path));
      else throw new Error(`Unsupported capture file: ${key}`);
    }
  };
  walk(root); return files;
}
const same = (a,b) => JSON.stringify(Object.entries(a).sort(([x],[y])=>x.localeCompare(y))) === JSON.stringify(Object.entries(b).sort(([x],[y])=>x.localeCompare(y)));
export function verifyHostReceipt(receipt, actual, previewBytes) {
  if (receipt.schema !== 'wildshard.conch.color-view.host-files.v1' || receipt.sourceFreezeSha256 !== FREEZE_SHA256
    || receipt.previewSha256 !== hash(previewBytes) || receipt.visualAcceptance !== false
    || receipt.runtimeAcceptance !== false || receipt.colliderAcceptance !== false
    || !receipt.files || typeof receipt.files !== 'object' || Array.isArray(receipt.files)) throw new Error('Invalid color-view host receipt');
  const files = { ...actual }; delete files['color-view-host-files.json'];
  if (!same(receipt.files, files)) throw new Error('Exact color-view host inventory mismatch');
}
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item==='object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item);
export function verifySelectedViewCaptureIdentity() {
  const admitted = admitReviewedBuild();
  // Read-only equivalent of the app adapter's product checks. Never acquire a build lease for QA.
  const previewRoot=resolve(ROOT,PREVIEW), product=join(previewRoot,'product');
  const productBytes=readFileSync(join(product,'shard.json')), index=JSON.parse(productBytes);
  const validation=JSON.parse(readFileSync(join(product,'validation.json')));
  const preview=JSON.parse(readFileSync(join(previewRoot,'preview.json')));
  const metadataBytes=readFileSync(join(previewRoot,'pack/metadata.json'));
  const metadata=JSON.parse(metadataBytes), payload=readFileSync(join(previewRoot,'pack/payload.bin'));
  if(validation.indexHash!==hash(productBytes) || typeof validation.revision!=='string'
    || preview.mode!=='color-view' || preview.candidate!==admitted.manifest.candidate
    || canonical(preview.buildPin)!==canonical(admitted.buildPin) || canonical(preview.sourceFreeze)!==canonical(admitted.manifest)
    || canonical(preview.admission)!==canonical(admitted.receipt) || canonical(metadata)!==canonical(admitted.metadata)
    || !payload.equals(admitted.payload) || preview.metadataSha256!==hash(metadataBytes) || preview.packedSha256!==hash(payload)
    || preview.bodyFile!==metadata.file || !metadata.file.includes(preview.packedSha256)
    || preview.sourceHash!==index.build.sourceHash || preview.visualAcceptance!==false || preview.runtimeAcceptance!==false || preview.colliderAcceptance!==false)
    throw new Error('SelectedView validated product or native tuple mismatch');
  const productFiles=Object.fromEntries(Object.entries(exactInventory(product)).map(([path,digest])=>[`product/${path}`,digest]));
  if(canonical(preview.productFiles)!==canonical(productFiles)) throw new Error('SelectedView product inventory changed');
  assertCandidatePose(ROOT,index,product);
  const built = resolve(ROOT, DIST), actual = exactInventory(built);
  const bytes = readFileSync(join(built, 'conch-preview.json'));
  if (!bytes.equals(readFileSync(resolve(ROOT, PREVIEW, 'preview.json')))) throw new Error('Host preview differs from validated product');
  const receiptBytes = readFileSync(join(built, 'color-view-host-files.json'));
  verifyHostReceipt(JSON.parse(receiptBytes), actual, bytes);
  return { buildPin: admitted.buildPin, buildPinSha256: hash(readFileSync(resolve(ROOT, BUILD_PIN))),
    previewSha256: hash(bytes), hostInventorySha256: hash(receiptBytes), files: actual,
    acceptance: { runtime: false, visual: false, animation: false, interruptedContinuity: false } };
}
export function newCaptureDirectory(path) {
  const output = resolve(path), allowed = resolve(ROOT, 'tmp/conch-color-view-qa');
  if (!output.startsWith(`${allowed}/`)) throw new Error('Capture output must be a new attempt under tmp/conch-color-view-qa');
  for (let parent = dirname(output); parent !== dirname(parent); parent = dirname(parent))
    if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw new Error('Symlink in capture output parent');
  if (existsSync(output)) throw new Error('Preserve previous attempt: output already exists');
  mkdirSync(output, { recursive: true }); return output;
}
