// oxlint-disable-next-line import/no-nodejs-modules -- Native fixtures read only the remaining unconverted source assets.
import fs from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- These fixture programs run from the repository root.
import { resolve } from 'node:path';
import { templateTerrain } from '../../src/shards/_template/generators/terrain';
import { templateProduct } from '../../src/shards/_template/generators/product';
import { compileScript } from '../../src/sdk/bake/compileScript';
import { compileTemplateBehaviour, TEMPLATE_BEHAVIOUR_INPUTS, TemplateBehaviourSchema } from '../../src/shards/_template/generators/behaviour';
import * as v from 'valibot';
import { templatePropRows } from '../../src/shards/_template/generators/props';

const scripts = await compileTemplateBehaviour({ compileScript }, new Map(TEMPLATE_BEHAVIOUR_INPUTS.map(file => [file, new Uint8Array(fs.readFileSync(resolve('src/shards/_template', file)))])));
const metadata = scripts.get('behaviour.json'); if (metadata === undefined) throw new Error('Missing compiled fixture behaviour');
export const TEMPLATE_BEHAVIOUR = v.parse(TemplateBehaviourSchema, JSON.parse(new TextDecoder().decode(metadata)));
const { assets: terrain, ...rows } = templateTerrain(), props = templatePropRows(), generated = new Map([...terrain, ...props.assets, ...[...scripts].filter(([key]) => key !== 'behaviour.json')]);
/** Native tests consume the same producer rows and bytes as the executable build entry. */
export const TEMPLATE_SOURCE = templateProduct(rows, props, TEMPLATE_BEHAVIOUR);
/** Preserve independently owned input bytes for each admission. Other producers migrate in subsequent GR1 slices. */
export function templateAssets(): Map<string, Uint8Array> {
  return new Map(TEMPLATE_SOURCE.files.map(file => [file.hash,
    new Uint8Array(generated.get(file.hash) ?? fs.readFileSync(resolve('src/shards/_template/assets', file.hash)))]));
}
