import { ReinPresentationSchema, type ReinPresentationRows } from '@wildshard/format/riding';
import { parse } from 'valibot';

let prepared: ReinPresentationRows | null = null;
export function prepareNalatiReins(input: unknown): void { prepared = parse(ReinPresentationSchema, input); }
export function nalatiReinRows(): ReinPresentationRows { if (prepared === null) throw new Error('Nalati rein rows are not prepared'); return prepared; }
