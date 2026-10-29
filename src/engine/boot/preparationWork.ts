import { validationSourceBytes } from '@wildshard/format/validationReceipt';

/** The original data operations, with no renderer, storage or ambient world. */
export function preparationWork(kind: 'parse' | 'receipt', value: unknown): unknown {
  if (kind === 'receipt') return validationSourceBytes(value);
  if (!(value instanceof Uint8Array)) throw new TypeError('Data parser requires bytes');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value));
}
