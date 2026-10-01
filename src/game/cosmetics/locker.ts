import * as v from 'valibot';
import { saves, type SaveSlot, type SkinDef, type WeaponId } from '#engine';

export interface CosmeticState { owned: string[]; worn: Record<string, string> }
export interface CosmeticDef<Slot extends string> { id: string; slot: Slot }
export interface CosmeticProfile<Slot extends string, Row extends { id: string }> { slot: (row: Row) => Slot; save: Pick<SaveSlot<CosmeticState>, 'read' | 'write'>; autoWear?: boolean }

const skinSave = saves.define({ key: 'skins', scope: 'shard', version: 1,
  schema: v.object({ owned: v.array(v.string()), worn: v.record(v.string(), v.string()) }),
  initial: () => ({ owned: [] as string[], worn: {} as Record<string, string> }) });

/** One ownership and wear service; shard profiles supply rows, persistence and auto-wear policy. */
export class CosmeticsLocker<Slot extends string, Row extends { id: string }> {
  readonly owned = new Set<string>();
  readonly worn: Partial<Record<Slot, string>> = {};
  private readonly rows: ReadonlyMap<string, Row>;
  version = 0;
  onChange?: (() => void) | undefined;

  constructor(private readonly namespace: string, rows: readonly Row[], private readonly profile: CosmeticProfile<Slot, Row>) {
    this.rows = new Map(rows.map((row) => [row.id, row]));
    try {
      const state = profile.save.read(namespace);
      for (const id of state.owned) if (this.rows.has(id)) this.owned.add(id);
      for (const [slot, id] of Object.entries(state.worn)) {
        const row = this.rows.get(id);
        if (row !== undefined && profile.slot(row) === slot && this.owned.has(id)) this.worn[this.profile.slot(row)] = id;
      }
    } catch { /* fresh locker */ }
  }
  private save(): void {
    this.changed?.();
    this.version++;
    const worn: Record<string, string> = {};
    for (const [slot, id] of Object.entries<string | undefined>(this.worn)) if (id !== undefined) worn[slot] = id;
    try { this.profile.save.write({ owned: [...this.owned], worn }, this.namespace); } catch { /* not persisted */ }
    this.onChange?.();
  }
  protected changed?: () => void;
  has(id: string): boolean { return this.owned.has(id); }
  own(id: string): void {
    const row = this.rows.get(id);
    if (row === undefined || this.owned.has(id)) return;
    this.owned.add(id);
    if (this.profile.autoWear) this.worn[this.profile.slot(row)] ??= id;
    this.save();
  }
  wearing(slot: Slot): Row | null { const id = this.worn[slot]; return id === undefined ? null : this.rows.get(id) ?? null; }
  private wearingSlot(id: string): Slot | undefined { const row = this.rows.get(id); return row === undefined ? undefined : this.profile.slot(row); }
  wear(slot: Slot, id: string | null): void {
    if (id !== null && (!this.owned.has(id) || this.wearingSlot(id) !== slot)) return;
    if (id === null) delete this.worn[slot]; else this.worn[slot] = id;
    this.save();
  }
  toggle(id: string): void {
    const row = this.rows.get(id);
    if (row === undefined || !this.owned.has(id)) return;
    this.wear(this.profile.slot(row), this.worn[this.profile.slot(row)] === id ? null : id);
  }
  entries(): (Row & { worn: boolean })[] {
    const entries: (Row & { worn: boolean })[] = [];
    for (const row of this.rows.values()) if (this.has(row.id)) entries.push({ ...row, worn: this.worn[this.profile.slot(row)] === row.id });
    return entries;
  }
}

/** Weapon-material profile, with the original shard-scoped save and manual wear policy. */
export class SkinLocker extends CosmeticsLocker<WeaponId, SkinDef> {
  constructor(namespace: string, rows: readonly SkinDef[] = []) {
    super(namespace, rows, { save: skinSave, slot: (row) => row.weapon });
  }
}
