import { expect, test } from 'vitest';
import original from './fixtures/nalati-weatherChannels-original.json' with { type: 'json' };
import { parseClientChannels } from '../src/sdk/rows';
import { visualExpression } from '../src/shards/nalati-grasslands/generators/visualExpression';
import { visualPack, weatherFxChannels } from '../src/shards/nalati-grasslands/generators/weatherFxChannels';
import { skyChannels } from '../src/shards/nalati-grasslands/generators/skyPresentation';

test('weather and sky expression lowering retains every original numeric node and binding', () => {
  const rows = parseClientChannels(original.clientChannels);
  expect(weatherFxChannels()).toEqual(rows.filter(row => row.id.startsWith('nalati.fx.')));
  expect(skyChannels()).toEqual(rows.filter(row => row.id.startsWith('nalati.sky.')));
});

test('visual expressions retain arithmetic association, unary precedence and nested selections', () => {
  const number = (value: number) => ({ kind: 'number', value });
  expect(visualExpression('8 / 4 / 2')).toEqual({ kind: 'binary', op: '/', left: { kind: 'binary', op: '/', left: number(8), right: number(4) }, right: number(2) });
  expect(visualExpression('-2 * 3')).toEqual({ kind: 'binary', op: '*', left: { kind: 'negative', value: number(2) }, right: number(3) });
  expect(visualExpression('key.sun[2]')).toEqual({ kind: 'read', name: 'key.sun.2' });
  expect(visualExpression('a ? 1 : b ? 2 : 3')).toEqual({ kind: 'select', condition: { kind: 'read', name: 'a' }, yes: number(1), no: { kind: 'select', condition: { kind: 'read', name: 'b' }, yes: number(2), no: number(3) } });
});

test('unsupported visual source refuses instead of executing JavaScript', () => {
  for (const expression of ['a = 1', 'a; b', 'a[unknown]', '((a)', '']) expect(() => visualExpression(expression)).toThrow();
  expect(() => visualPack([{ target: 'test', path: 'value', expression: 'random(1)' }], 'refusal', 'refusal')).toThrow('Unknown visual function');
});
