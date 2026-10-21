// The approved cache-miss path runs ordinary lint; typed rules run in CI.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import * as v from 'valibot';

/** Preserve every ordinary rule and override while deferring typed rules.
 * @param {unknown} raw */
export function untypedLintConfig(raw) {
  const config = v.parse(v.looseObject({ options: v.looseObject({ typeAware: v.boolean() }) }), raw);
  config.options.typeAware = false;
  return config;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const input = ts.readConfigFile(resolve('.oxlintrc.json'), path => ts.sys.readFile(path));
  if (input.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(input.error.messageText, '\n'));
  /** @type {unknown} */
  const raw = input.config;
  writeFileSync(resolve('.push-untyped.oxlint.json'), JSON.stringify(untypedLintConfig(raw)));
}
