#!/usr/bin/env node
// Safari Inspector does not persist a Page.setBootstrapScript across its process swap.
// Inject only the ordinary harness pins in the OWNED served export's HTML, before modules.
// No game bundle, asset, resource policy or persistent save changes; never touch repository index.html.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [html, build] = process.argv.slice(2);
if (!html || !build || !html.startsWith('/private/tmp/wildshard-serve/')) throw new Error('sim-bootstrap.mjs <owned exported index.html> <build>');
const before = readFileSync(html, 'utf8');
if (before.includes('sf22a-memory-locations')) throw new Error('already instrumented');
const pins = { seed: 1, capture: null, lane: 'sf22a-memory-locations', sha: build, browser: 'simulator-safari', errors: [], saves: { read: [], written: [] }, audioRequests: [] };
const injection = `<script>window.__wildshardHarness??=${JSON.stringify(pins)};</script>`;
const after = before.replace('<head>', `<head>${injection}`);
if (after === before || after.replace(injection, '') !== before) throw new Error('HTML injection failed');
writeFileSync(html, after);
console.log(JSON.stringify({ build, injection, originalHTMLSHA256: createHash('sha256').update(before).digest('hex'), instrumentedHTMLSHA256: createHash('sha256').update(after).digest('hex') }, null, 2));
