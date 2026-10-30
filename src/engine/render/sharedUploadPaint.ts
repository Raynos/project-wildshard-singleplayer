import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

let saved: ReturnType<typeof jsonSlot> | undefined;
function setting(): ReturnType<typeof jsonSlot> { return (saved ??= jsonSlot('debug.sharedUploadPaint', 'device')); }
/** CI9: back-to-back compressed texture uploads share the paint between them (one frame an upload, not two). Off by
 *  default: on the iPhone Simulator it loaded Pine faster but its worst loader frame rose (~220 -> ~300 ms), so the old
 *  pacing stays until a phone reading; Debug ▸ Loading ▸ Shared upload paint (the row reloads). */
export function sharedUploadPaint(): boolean { return isDev() && setting().read() === true; }
/** The same Developer fence protects programmatic changes and saved picks. */
export function setSharedUploadPaint(value: boolean): void { if (isDev()) setting().write(value); }
