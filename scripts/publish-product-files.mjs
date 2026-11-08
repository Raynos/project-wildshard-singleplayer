// Publish the complete immutable product URL contract, including files whose
// packed copies remain useful to the boot loader. Worker/approach readers also
// request their declared loose URLs; DL20 cannot remove those public endpoints.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export function publishProductFiles(engine, output) {
  const products = resolve(output, 'shardfiles');
  let restored = 0, bytes = 0, emptyRecords = 0;
  for (const folder of readdirSync(products, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const destination = resolve(products, folder.name);
    const manifest = resolve(destination, 'shard.json');
    if (!existsSync(manifest)) continue;
    const product = JSON.parse(readFileSync(manifest, 'utf8'));
    if (product.identity.slug !== folder.name || !/^[a-z0-9][a-z0-9-]*$/u.test(folder.name)) throw new Error('Invalid published product identity');
    for (const file of product.files) {
      if (typeof file.path !== 'string' || !file.path.startsWith('blobs/') || file.path.split('/').some(part => part === '' || part === '.' || part === '..')
        || !/^[a-f0-9]{64}$/u.test(file.hash) || !Number.isSafeInteger(file.compressed) || file.compressed < 0) throw new Error('Invalid published product file');
      const target = resolve(destination, file.path);
      if (!target.startsWith(destination + sep)) throw new Error('Product file escapes its public directory');
      const present = existsSync(target);
      const source = present ? target : resolve(engine, 'out', folder.name, file.path);
      if (!lstatSync(source).isFile()) throw new Error('Product publication requires a regular file');
      const body = readFileSync(source);
      if (body.length !== file.compressed || createHash('sha256').update(body).digest('hex') !== file.hash) throw new Error(`Product publication hash or size differs: ${folder.name}/${file.path}`);
      if (!present) {
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
        restored++; bytes += body.length;
      }
    }
    // The runtime probes this optional read-ahead record even when the admitted
    // product supplies none. [] honestly declares no recorded reads (the format's
    // empty EntryReadSet); preserve every supplied record without alteration.
    const record = resolve(output, 'assets', folder.name, 'entry-reads.json');
    if (!existsSync(record)) {
      mkdirSync(dirname(record), { recursive: true });
      writeFileSync(record, '[]\n');
      emptyRecords++;
    }
  }
  console.log(`Product URL closure: restored ${restored} exact files (${bytes} bytes); ${emptyRecords} absent read-ahead records declared empty`);
  return { restored, bytes, emptyRecords };
}
