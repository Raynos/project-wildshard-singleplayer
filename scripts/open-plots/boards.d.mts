export interface BoardCapture {
  source: string; slug: string; instance: string; milestone: 'RM2' | 'RM3' | 'END' | 'OP4';
  domes: { dome: string; complete: true; errors: string[]; cameras:{convention:string}; views: { n: number; name: string; imageSha256: string }[] }[];
}
export function admitBoardCapture(value: unknown): BoardCapture;
export function boardText(text: string): string;
export function makeDomeBoards(folder: string): Promise<{ dome: string; file: string; bytes: number; sha256: string }[]>;
