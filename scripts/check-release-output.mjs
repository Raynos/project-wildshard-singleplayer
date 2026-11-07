// Vercel packages the proven dist; it must never compile a second game.
import { readFileSync, existsSync } from 'node:fs';
const pin = JSON.parse(readFileSync('engine.pin.json', 'utf8'));
const version = JSON.parse(readFileSync('dist/version.json', 'utf8'));
if (version.saveEpoch !== pin.saveEpoch || !existsSync('dist/index.html') || !existsSync('dist/sw.js')) throw new Error('Incomplete or mismatched pinned release output');
console.log(`Packaging verified artifact ${version.build}, epoch ${version.saveEpoch}`);
