import { Matrix4, Object3D, Vector3 } from 'three';
import { updateAuthoringMatrix } from './sceneTransform';
/** A road socket's boundary edge, with +Z north. */
export type EntryEdge = 'north' | 'east' | 'south' | 'west';
/** Authored entry row for the four road-height midpoint openings. */
export interface EntryData {
    edge: EntryEdge;
    at: [
        number,
        number,
        number
    ];
    width: 8;
    kind?: 'ground' | 'socketOverWater';
}
const MIDPOINTS = { north: [0, 0, 250], east: [250, 0, 0], south: [0, 0, -250], west: [-250, 0, 0] } as const;
/** A fixed 8 x 15 metre socket declaration; it does not create a floor or flatten authored ground. */
export class Entry extends Object3D {
    constructor(public edge: EntryEdge = 'north', public kind?: EntryData['kind']) {
        super();
        this.name = `entry.${edge}`;
        const at = MIDPOINTS[edge];
        this.position.set(at[0], at[1], at[2]);
    }
    /** Clone the edge and kind with the normal scene transform and hierarchy. */
    override copy(source: this, recursive = true): this { super.copy(source, recursive); this.edge = source.edge; this.kind = source.kind; return this; }
    /** The four independent midpoint objects, in north/east/south/west order. */
    static midpoints(): Entry[] { return (['north', 'east', 'south', 'west'] as const).map(edge => new Entry(edge)); }
    /** Entries must retain their exact road-height world midpoint; geometry proof happens during validation. */
    toEntryData(): EntryData {
        updateAuthoringMatrix(this);
        const at = new Vector3().setFromMatrixPosition(this.matrixWorld);
        if (!at.equals(new Vector3(...MIDPOINTS[this.edge])))
            throw new Error('Entry must remain at its road-height midpoint');
        const expected = new Matrix4().makeTranslation(at.x, at.y, at.z);
        if (this.matrixWorld.elements.some((value, index) => !Number.isFinite(value) || Math.abs(value - (expected.elements[index] ?? Infinity)) > 1e-8))
            throw new Error('Entry socket frame cannot rotate, scale or shear');
        return { edge: this.edge, at: [at.x, at.y, at.z], width: 8, ...(this.kind === undefined ? {} : { kind: this.kind }) };
    }
}
