import { useEffect, useRef, useState } from 'react';
import { exportBackup, importBackup } from './backup';
import type { Note } from './notes';
import { createNotesRepository, type NotesRepository } from './storage';
import './styles.css';

const defaultRepository = createNotesRepository();
type SaveState = 'saving' | 'saved' | 'error';

function Icon({ name }: { name: 'download' | 'upload' | 'close' }) {
  const path = {
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" /></>,
    upload: <><path d="M12 16V4m0 0 4 4m-4-4L8 8M4 17v3h16v-3" /></>,
    close: <path d="M5 5l14 14M19 5 5 19" />,
  }[name];
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
}

function noteText(note: Note): string {
  if (!note.title.trim()) return note.body;
  return note.body.trim() ? `${note.title}\n\n${note.body}` : note.title;
}

function singleNote(notes: Note[], lastId: string | null): Note | null {
  if (!notes.length) return null;
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const first = recent.find((note) => note.id === lastId) ?? recent[0];
  if (notes.length === 1 && !first.title) return first;
  const ordered = [first, ...recent.filter((note) => note.id !== first.id)];
  return {
    ...first,
    title: '',
    body: ordered.map(noteText).filter((text) => text.trim()).join('\n\n\n'),
    updatedAt: Date.now(),
  };
}

export default function App({ repository = defaultRepository }: { repository?: NotesRepository }) {
  const [note, setNote] = useState<Note | null>(null);
  const noteRef = useRef<Note | null>(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [storageError, setStorageError] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<Note | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);

  function showNote(next: Note | null) {
    noteRef.current = next;
    setNote(next);
  }

  function flushSave(): Promise<void> {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const snapshot = pending.current;
    if (!snapshot) return chain.current;
    pending.current = null;
    const savingRevision = revision.current;
    chain.current = chain.current.catch(() => undefined).then(() => repository.putNote(snapshot));
    chain.current.then(() => {
      if (revision.current === savingRevision) setSaveState('saved');
    }).catch(() => {
      if (revision.current === savingRevision) setSaveState('error');
      setStorageError('Could not save. Export a backup before closing this page.');
    });
    return chain.current;
  }

  function editBody(body: string) {
    const previous = noteRef.current;
    const now = Date.now();
    const next: Note = previous
      ? { ...previous, body, updatedAt: now }
      : { id: crypto.randomUUID(), title: '', body, createdAt: now, updatedAt: now };
    showNote(next);
    pending.current = next;
    revision.current += 1;
    setSaveState('saving');
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushSave(), 180);
  }

  useEffect(() => {
    let mounted = true;
    void Promise.all([repository.getNotes(), repository.getLastNoteId()])
      .then(async ([notes, lastId]) => {
        const current = singleNote(notes, lastId);
        if (current && (notes.length > 1 || notes[0].title)) await repository.replaceNotes(current);
        if (!mounted) return;
        showNote(current);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setStorageError('Browser storage is unavailable. Your writing may not be saved.');
        setReady(true);
      });
    return () => { mounted = false; };
  }, [repository]);

  useEffect(() => {
    if (ready) editorRef.current?.focus();
  }, [ready]);

  useEffect(() => {
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') void flushSave();
    };
    document.addEventListener('visibilitychange', flushOnHide);
    return () => {
      document.removeEventListener('visibilitychange', flushOnHide);
      void flushSave();
    };
  }, [repository]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void flushSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function downloadBackup() {
    const content = exportBackup(noteRef.current ? [noteRef.current] : [], new Date().toISOString());
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `notas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadBackup(file: File) {
    try {
      const imported = importBackup(await file.text(), () => crypto.randomUUID());
      const importedText = imported.map(noteText).filter((text) => text.trim()).join('\n\n\n');
      if (importedText) {
        const existing = noteRef.current?.body ?? '';
        editBody(existing ? `${existing}\n\n\n${importedText}` : importedText);
        await flushSave();
      }
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error && error.message === 'Invalid backup file'
        ? 'That file is not a valid Notas backup.'
        : 'Could not save the imported text. Export a backup before closing this page.');
    }
    if (importRef.current) importRef.current.value = '';
  }

  const statusLabel = saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Unable to save' : 'Saved locally';

  return (
    <main className="app-shell">
      <header className="topbar">
        <span className="brand" aria-label="Notas">notas<span className="brand-dot">.</span></span>
        <div className="topbar-actions">
          <span className={`save-indicator ${saveState}`} role="status" aria-label={statusLabel} title={statusLabel}><span className="save-dot" /></span>
          <span className="action-divider" />
          <button className="icon-button" aria-label="Export backup" title="Export backup" onClick={downloadBackup} disabled={!ready || !note?.body}><Icon name="download" /></button>
          <button className="icon-button" aria-label="Import backup" title="Import backup" onClick={() => importRef.current?.click()} disabled={!ready}><Icon name="upload" /></button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Import backup file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadBackup(file); }} />
        </div>
      </header>

      {storageError && <div className="error-banner" role="alert">{storageError}<button className="icon-button" aria-label="Dismiss message" onClick={() => setStorageError('')}><Icon name="close" /></button></div>}

      <div className="editor-wrap">
        <textarea
          ref={editorRef}
          className="editor"
          aria-label="Note"
          placeholder="Start writing…"
          value={note?.body ?? ''}
          onChange={(event) => editBody(event.target.value)}
          onBlur={() => void flushSave()}
          disabled={!ready}
          spellCheck
        />
      </div>
    </main>
  );
}
