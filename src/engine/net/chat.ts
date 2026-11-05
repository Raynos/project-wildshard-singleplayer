import type { ChatChannel } from './acts';
import { filterWords, MAX_CHAT_BYTES, plainLine } from './chatFilter';

// P1-E5.2c (J110, M5): chat on the server. A line is cleaned and filtered here before anyone hears it, its speaker's flood is
// capped, and the room keeps what was really typed for a while, so a report can show it.

/** How far a proximity line carries, in metres. */
export const CHAT_RADIUS = 30;
/** Lines a speaker may send in a window of ticks: five every five seconds. */
const LINES_PER_WINDOW = 5, WINDOW_TICKS = 300;
/** Lines a report can still name. */
const KEPT_LINES = 256;

/** A report of a line, for whoever moderates. It holds what was typed, which no client ever hears filtered away. */
export interface ChatReport { readonly reporter: string; readonly speaker: string; readonly name: string; readonly channel: ChatChannel; readonly typed: string; readonly shown: string; readonly tick: number }
/** Where reports go. Where that ends up is decided later; the room only hands them over. */
export interface ChatReports { file: (report: ChatReport) => void }
/** Who is speaking: their stable id, their Name, and the sim player the room measures distance from. */
export interface ChatSpeaker { readonly player: string; readonly name: string; readonly body: string }
/** A line on its way to the next frame. */
export interface ChatLine { readonly line: number; readonly channel: ChatChannel; readonly body: string; readonly name: string; readonly text: string; readonly tick: number }
interface KeptLine { readonly speaker: string; readonly name: string; readonly channel: ChatChannel; readonly typed: string; readonly shown: string; readonly tick: number; readonly reporters: Set<string> }

/** One room's chat. */
export class RoomChat {
  private readonly reports: ChatReports | undefined;
  private readonly kept = new Map<number, KeptLine>();
  private readonly recent = new Map<string, number[]>();
  private readonly pending: ChatLine[] = [];
  private next = 0;
  constructor(reports?: ChatReports) { this.reports = reports; }
  /** Take a line. False if it is empty once cleaned, or the speaker is flooding. */
  say(speaker: ChatSpeaker, channel: ChatChannel, typed: string, tick: number): boolean {
    const clean = plainLine(typed, MAX_CHAT_BYTES);
    if (clean === '' || !this.allowed(speaker.player, tick)) return false;
    const line = ++this.next, shown = filterWords(clean);
    this.kept.set(line, { speaker: speaker.player, name: speaker.name, channel, typed: clean, shown, tick, reporters: new Set() });
    if (this.kept.size > KEPT_LINES) for (const old of this.kept.keys()) { this.kept.delete(old); break; }
    this.pending.push({ line, channel, body: speaker.body, name: speaker.name, text: shown, tick });
    return true;
  }
  /** Hand a report of `line` to the port, once per reporter. False if nobody can report it: gone, their own, or already theirs. */
  report(reporter: string, line: number): boolean {
    const kept = this.kept.get(line);
    if (kept === undefined || kept.speaker === reporter || kept.reporters.has(reporter)) return false;
    kept.reporters.add(reporter);
    const { reporters: _reporters, ...report } = kept;
    this.reports?.file({ ...report, reporter });
    return true;
  }
  /** The lines waiting for this frame. */
  drain(): readonly ChatLine[] { return this.pending.splice(0); }
  private allowed(player: string, tick: number): boolean {
    const held = (this.recent.get(player) ?? []).filter(at => tick - at < WINDOW_TICKS);
    if (held.length < LINES_PER_WINDOW) held.push(tick);
    else { this.recent.set(player, held); return false; }
    this.recent.set(player, held);
    return true;
  }
}
