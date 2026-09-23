import { describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import type { Note } from './notes';

const note: Note = {
  id: 'original',
  title: 'A note',
  body: 'A body',
  createdAt: 100,
  updatedAt: 200,
};

describe('JSON backup', () => {
  it('exports notes and imports them with new IDs', () => {
    const file = exportBackup([note], '2026-09-23T00:00:00.000Z');
    const imported = importBackup(file, () => 'new-id');

    expect(JSON.parse(file)).toMatchObject({ format: 'notas', version: 1 });
    expect(imported).toEqual([{ ...note, id: 'new-id' }]);
  });

  it('rejects malformed backups before returning any notes', () => {
    const malformed = JSON.stringify({
      format: 'notas',
      version: 1,
      notes: [note, { id: 'bad', title: 4, body: '', createdAt: 1, updatedAt: 1 }],
    });

    expect(() => importBackup(malformed, () => 'new-id')).toThrow('Invalid backup file');
    expect(() => importBackup('{', () => 'new-id')).toThrow('Invalid backup file');
  });

  it('rejects dates the editor cannot display', () => {
    const file = JSON.stringify({ format: 'notas', version: 1, exportedAt: '2026-09-23T00:00:00.000Z', notes: [{ ...note, createdAt: Number.MAX_VALUE }] });
    expect(() => importBackup(file, () => 'new-id')).toThrow('Invalid backup file');
  });
});
