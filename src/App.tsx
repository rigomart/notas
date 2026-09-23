import { useEffect, useRef, useState } from 'preact/hooks';
import { exportBackup, importBackup } from './backup';
import type { Note } from './notes';
import { createNotesRepository, type NotesRepository } from './storage';

// Opened lazily so the app can be prerendered where IndexedDB does not exist.
let sharedRepository: NotesRepository | undefined;
const defaultRepository = () => (sharedRepository ??= createNotesRepository());

type SaveState = 'saving' | 'saved' | 'error';
const WRITING_IDLE_MS = 1400;

function Icon({ name }: { name: 'download' | 'upload' | 'close' }) {
  const path = {
    download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />,
    upload: <path d="M12 15V4m0 0 4 4m-4-4L8 8M5 19h14" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
  }[name];
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>;
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

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

function textStats(text: string) {
  let characters = 0;
  for (const _ of text) characters += 1; // Code points, so an emoji counts once.
  return {
    words: plural(text.match(/\S+/g)?.length ?? 0, 'word', 'words'),
    characters: plural(characters, 'character', 'characters'),
  };
}

export default function App({ repository }: { repository?: NotesRepository }) {
  const [note, setNote] = useState<Note | null>(null);
  const noteRef = useRef<Note | null>(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [storageError, setStorageError] = useState('');
  const [writing, setWriting] = useState(false);
  const [selection, setSelection] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  const writingTimer = useRef<number | null>(null);
  const pending = useRef<Note | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const repo = () => repository ?? defaultRepository();

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
    chain.current = chain.current.catch(() => undefined).then(() => repo().putNote(snapshot));
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

  // Chrome fades out while typing and returns on a pause or a real pointer move.
  function startWriting() {
    setWriting(true);
    if (writingTimer.current !== null) window.clearTimeout(writingTimer.current);
    writingTimer.current = window.setTimeout(() => setWriting(false), WRITING_IDLE_MS);
  }

  function syncSelection() {
    const editor = editorRef.current;
    if (!editor || document.activeElement !== editor) return setSelection('');
    setSelection(editor.value.slice(editor.selectionStart, editor.selectionEnd));
  }

  useEffect(() => {
    // Also catches selections collapsed by a click or arrow key, which fire no `select` event.
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, []);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (Math.abs(event.movementX) + Math.abs(event.movementY) < 3) return;
      if (writingTimer.current !== null) window.clearTimeout(writingTimer.current);
      setWriting(false);
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (writingTimer.current !== null) window.clearTimeout(writingTimer.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const repository = repo();
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
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void flushSave();
      }
    }
    document.addEventListener('visibilitychange', flushOnHide);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('visibilitychange', flushOnHide);
      window.removeEventListener('keydown', onKeyDown);
      void flushSave();
    };
  }, [repository]);

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

  const body = note?.body ?? '';
  const stats = textStats(selection || body);
  const statusLabel = saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Unable to save' : 'Saved locally';

  return (
    <main class="app" data-ready={ready || undefined} data-writing={writing || undefined}>
      <span class="island island-top island-left brand">notas<span class="brand-dot" aria-hidden="true">.</span></span>
      <div class="island island-top island-right actions">
        <span class="save" data-state={saveState} role="status" aria-label={statusLabel} title={statusLabel} />
        <button class="icon-button" aria-label="Export backup" title="Export backup" onClick={downloadBackup} disabled={!ready || !body}><Icon name="download" /></button>
        <button class="icon-button" aria-label="Import backup" title="Import backup" onClick={() => importRef.current?.click()} disabled={!ready}><Icon name="upload" /></button>
        <input ref={importRef} class="visually-hidden" type="file" accept=".json,application/json" aria-label="Import backup file" tabIndex={-1} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void loadBackup(file); }} />
      </div>

      <textarea
        ref={editorRef}
        class="editor"
        aria-label="Note"
        placeholder="Start writing…"
        value={body}
        onInput={(event) => {
          const editor = event.currentTarget;
          editBody(editor.value);
          startWriting();
          // Writing at the end keeps the newest line clear of the faded bottom edge.
          if (editor.selectionEnd === editor.value.length) editor.scrollTop = editor.scrollHeight;
        }}
        onSelect={syncSelection}
        onFocus={syncSelection}
        onBlur={() => { setSelection(''); void flushSave(); }}
        disabled={!ready}
        spellcheck
      />

      {body && (
        // Keyed by mode so switching between note and selection counts replays the fade.
        <div class="island island-bottom island-right counts" key={selection ? 'selection' : 'note'} data-selection={selection ? '' : undefined}>
          {selection && <span class="counts-label">Selected</span>}
          <span>{stats.words}</span>
          <span>{stats.characters}</span>
        </div>
      )}

      {storageError && (
        <div class="toast" role="alert">
          <span>{storageError}</span>
          <button class="icon-button" aria-label="Dismiss message" onClick={() => setStorageError('')}><Icon name="close" /></button>
        </div>
      )}
    </main>
  );
}
