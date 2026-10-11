// G320: retained authoring geometry, collider rows and seeded scatter; no runtime capture.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeProps } from '@wildshard/sdk/bake/props';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { templateProps } from './templatePropsSource.ts';

const project = resolve(import.meta.dirname, '..');
const fixture = templateProps(20);
try {
  const props = bakeProps(fixture.source);
  mkdirSync(resolve(project, 'assets'), { recursive: true });
  for (const [hash, bytes] of props.assets) writeFileSync(resolve(project, 'assets', hash), bytes);
  const rows = { props: props.props, tiles: props.tiles, files: props.files, library: props.library, far: props.far, report: props.report };
  writeFileSync(resolve(project, 'data/props.json'), encodeCanonicalJson(rows));
  console.info(`template props: ${String(props.assets.size)} immutable files, authoring-only`);
} finally { fixture.dispose(); }
