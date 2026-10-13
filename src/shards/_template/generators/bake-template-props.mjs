// G320: retained authoring geometry, collider rows and seeded scatter; no runtime capture.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bake } from '@wildshard/sdk/bake';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { templateScene } from './templatePropsSource.ts';

const project = resolve(import.meta.dirname, '..');
const fixture = templateScene(20);
try {
  const props = bake(fixture.scene, { slug: 'template', name: 'Template shard' }, { props: fixture.props }).props;
  if (props === null) throw new Error('template scene baked no props');
  mkdirSync(resolve(project, 'assets'), { recursive: true });
  for (const [hash, bytes] of props.assets) writeFileSync(resolve(project, 'assets', hash), bytes);
  const rows = { props: props.props, tiles: props.tiles, files: props.files, library: props.library, far: props.far, report: props.report };
  writeFileSync(resolve(project, 'data/props.json'), encodeCanonicalJson(rows));
  console.info(`template props: ${String(props.assets.size)} immutable files, authoring-only`);
} finally { fixture.dispose(); }
