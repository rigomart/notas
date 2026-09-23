import { describe, expect, it } from 'vitest';
import { createNotesRepository } from './storage';
import type { Note } from './notes';

const note: Note = {
  id: 'note-1',
  title: 'First thought',
  body: 'Keep this',
  createdAt: 10,
  updatedAt: 20,
};

describe('notes repository', () => {
  it('persists a note and the last selected note across repository instances', async () => {
    const name = crypto.randomUUID();
    const first = createNotesRepository(name);
    await first.putNote(note);
    await first.setLastNoteId(note.id);

    const reopened = createNotesRepository(name);
    expect(await reopened.getNotes()).toEqual([note]);
    expect(await reopened.getLastNoteId()).toBe(note.id);
  });

  it('removes only the deleted note', async () => {
    const repo = createNotesRepository(crypto.randomUUID());
    await repo.putNote(note);
    await repo.putNote({ ...note, id: 'note-2' });
    await repo.deleteNote(note.id);

    expect((await repo.getNotes()).map((item) => item.id)).toEqual(['note-2']);
  });

  it('does not leave a partial import when a bulk write fails', async () => {
    const repo = createNotesRepository(crypto.randomUUID());
    const invalid = { ...note, id: undefined } as unknown as Note;

    await expect(repo.putNotes([note, invalid])).rejects.toThrow();
    expect(await repo.getNotes()).toEqual([]);
  });
});
