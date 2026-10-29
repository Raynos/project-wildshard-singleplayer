import { encodeParsedPages } from './parsedPages';
import { validationSourceBytes } from '@wildshard/format/validationReceipt';

/** The original data operations, with no renderer, storage or ambient world. */
export function preparationWork(kind: 'parse' | 'parse-pages' | 'receipt', value: unknown): unknown {
  if (kind === 'receipt') return validationSourceBytes(value);
  if (!(value instanceof Uint8Array)) throw new TypeError('Data parser requires bytes');
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value));
  return kind === 'parse-pages' ? encodeParsedPages(parsed) : parsed;
}
