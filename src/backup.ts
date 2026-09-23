import type { Note } from './notes';

export function exportBackup(notes: Note[], exportedAt: string): string {
  return JSON.stringify({ format: 'notas', version: 1, exportedAt, notes }, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNote(value: unknown): value is Note {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.title === 'string'
    && typeof value.body === 'string'
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt)
    && Number.isFinite(new Date(value.createdAt).getTime())
    && typeof value.updatedAt === 'number'
    && Number.isFinite(value.updatedAt)
    && Number.isFinite(new Date(value.updatedAt).getTime());
}

export function importBackup(text: string, createId: () => string): Note[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid backup file');
  }

  if (!isRecord(data)
    || data.format !== 'notas'
    || data.version !== 1
    || typeof data.exportedAt !== 'string'
    || !Array.isArray(data.notes)
    || !data.notes.every(isNote)) {
    throw new Error('Invalid backup file');
  }

  return data.notes.map((note) => ({ ...note, id: createId() }));
}
