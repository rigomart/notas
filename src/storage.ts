import { openDB, type DBSchema } from 'idb';
import type { Note } from './notes';

interface NotesSchema extends DBSchema {
  notes: { key: string; value: Note };
  preferences: { key: string; value: { key: string; value: string | null } };
}

export type NotesRepository = {
  getNotes(): Promise<Note[]>;
  putNote(note: Note): Promise<void>;
  replaceNotes(note: Note): Promise<void>;
  putNotes(notes: Note[]): Promise<void>;
  deleteNote(id: string): Promise<void>;
  getLastNoteId(): Promise<string | null>;
  setLastNoteId(id: string | null): Promise<void>;
};

export function createNotesRepository(name = 'notas'): NotesRepository {
  const database = openDB<NotesSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('notes', { keyPath: 'id' });
      db.createObjectStore('preferences', { keyPath: 'key' });
    },
  });

  return {
    async getNotes() {
      return (await database).getAll('notes');
    },
    async putNote(note) {
      const tx = (await database).transaction('notes', 'readwrite');
      await tx.store.put(note);
      await tx.done;
    },
    async replaceNotes(note) {
      const tx = (await database).transaction('notes', 'readwrite');
      await tx.store.clear();
      await tx.store.put(note);
      await tx.done;
    },
    async putNotes(notes) {
      const tx = (await database).transaction('notes', 'readwrite');
      try {
        for (const note of notes) await tx.store.put(note);
        await tx.done;
      } catch (error) {
        try { tx.abort(); } catch { /* The transaction may already be closed. */ }
        await tx.done.catch(() => undefined);
        throw error;
      }
    },
    async deleteNote(id) {
      const tx = (await database).transaction('notes', 'readwrite');
      await tx.store.delete(id);
      await tx.done;
    },
    async getLastNoteId() {
      const preference = await (await database).get('preferences', 'lastNoteId');
      return preference?.value ?? null;
    },
    async setLastNoteId(id) {
      const tx = (await database).transaction('preferences', 'readwrite');
      await tx.store.put({ key: 'lastNoteId', value: id });
      await tx.done;
    },
  };
}
