import { nalatiKokparWire } from '../src/shards/nalati-grasslands/generators/kokparProgram';
import { expect, test } from 'vitest';
import { NALATI_CURRENT_KOKPAR, NALATI_KOKPAR, NALATI_COURSE_WASM } from './fixtures/nalati-kokpar';
import { NALATI_ADMISSION } from './fixtures/nalati-admission';
import { NALATI_CHARGE } from './fixtures/nalati-charge';
import { NALATI_WEATHER } from './fixtures/nalati-weather';
import { NALATI_TITAN_PROGRAMS } from './fixtures/nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './fixtures/nalati-riding';
import { originalHeldMetadata } from './fixtures/nalati-held-original';
import { nalatiScriptSections } from '../src/shards/nalati-grasslands/generators/scriptInventory';
import { scriptAdmissionRows } from '../src/format/scriptContract';
import { NALATI_COURSE_MODULE } from '../src/shards/nalati-grasslands/generators/kokparRows';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nameBlob } from '../src/sdk/blobs';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Scope } from '../src/engine/app/scope';

const hash = '6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102';

test('the course publishes its complete original bytes through normal named-module admission', () => {
  expect(NALATI_COURSE_WASM.byteLength).toBe(9786);
  expect(hashImmutableBytes(NALATI_COURSE_WASM)).toBe(hash);
  expect(NALATI_CURRENT_KOKPAR.course.bytes).toBe('');
  expect(NALATI_CURRENT_KOKPAR.course.script).toEqual(NALATI_KOKPAR.course.script);
  expect(NALATI_CURRENT_KOKPAR.compiled.courseBytes).toBe(atob(NALATI_KOKPAR.course.bytes).length);
  const blob = nameBlob(NALATI_COURSE_MODULE, 'wasm', NALATI_COURSE_WASM, { critical: true, script: { abi: 1, pages: 1 } });
  expect(blob.file).toMatchObject({ hash, compressed: 9786, decoded: 9786, critical: true });
  const sections = nalatiScriptSections(originalHeldMetadata().held.program.v2, NALATI_CURRENT_KOKPAR, NALATI_RIDING_PROGRAMS,
    NALATI_TITAN_PROGRAMS, NALATI_WEATHER.rows, NALATI_ADMISSION, NALATI_CHARGE.rows);
  const inventory = scriptAdmissionRows(sections);
  expect(new Set(inventory.map(row => row.module)).size).toBe(9);
  expect(inventory.find(row => row.id === 'practice.course')).toEqual(NALATI_CURRENT_KOKPAR.course.script);
});

test('the raw course preserves original projections and refuses absent, foreign and retired loans', () => {
  const owner = new Scope('course.raw'), foreign = new Scope('course.foreign');
  try {
    const row = NALATI_CURRENT_KOKPAR.course;
    expect(() => ReturnProgram.page(row, owner)).toThrow('raw return module loan');
    ReturnProgram.lendModules(owner, new Map([[hash, NALATI_COURSE_WASM]]), [row.script]);
    const raw = ReturnProgram.page(row, owner), original = ReturnProgram.page(NALATI_KOKPAR.course);
    const fields = Object.fromEntries(Object.values(row.script.fields).map(name => [name, 0]));
    for (const now of [0, .5, 2]) for (const signal of Object.keys(row.script.signals)) {
      expect(raw.project(signal, { ...fields, now })).toEqual(original.project(signal, { ...fields, now }));
    }
    expect(() => ReturnProgram.page(row, foreign)).toThrow('raw return module loan');
    const broken = owner.child('broken');
    expect(() => ReturnProgram.lendModules(broken, new Map([[hash, new Uint8Array([0])]]), [row.script])).toThrow('hash mismatch');
    owner.dispose();
    expect(() => raw.project('courseStep', fields)).toThrow('disposed');
  } finally { owner.dispose(); foreign.dispose(); }
});

test('the raw course cache refuses inline, incomplete and changed executable contracts', () => {
  const rows = NALATI_CURRENT_KOKPAR;
  for (const invalid of [
    { ...rows, course: { ...rows.course, bytes: NALATI_KOKPAR.course.bytes } },
    { ...rows, goals: [] },
    { ...rows, compiled: { ...rows.compiled, courseBytes: -1 } },
    { ...rows, compiled: { ...rows.compiled, source: 'changed.wasm' } },
    { ...rows, course: { ...rows.course, script: { ...rows.course.script, pages: 2 } } },
    { ...rows, program: { ...rows.program, script: { ...rows.program.script, source: 'behaviour/changed.as' } } },
  ]) expect(() => nalatiKokparWire(JSON.stringify(invalid))).toThrow();
});
