import { useEffect, useMemo, useRef, useState } from 'react';
import { exportBackup, importBackup } from './backup';
import type { Note } from './notes';
import { createNotesRepository, type NotesRepository } from './storage';
import './styles.css';

const defaultRepository = createNotesRepository();
type SaveState = 'saving' | 'saved' | 'error';
type IconName = 'plus' | 'search' | 'trash' | 'download' | 'upload' | 'menu' | 'note' | 'close' | 'arrow';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" /></>,
    upload: <><path d="M12 16V4m0 0 4 4m-4-4L8 8M4 17v3h16v-3" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    note: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function displayTitle(note: Note) {
  return note.title.trim() || note.body.trim().split('\n')[0] || 'Untitled note';
}

function noteDate(timestamp: number) {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) return 'Today';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export default function App({ repository = defaultRepository }: { repository?: NotesRepository }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<Record<string, SaveState>>({});
  const [storageError, setStorageError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleted, setDeleted] = useState<{ note: Note; removal: Promise<void> } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const timers = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, Note>());
  const chains = useRef(new Map<string, Promise<void>>());
  const revisions = useRef(new Map<string, number>());

  function updateNotes(next: Note[]) {
    notesRef.current = next;
    setNotes(next);
  }

  function markStatus(id: string, status: SaveState) {
    setStatuses((current) => ({ ...current, [id]: status }));
  }

  function flushSave(id: string): Promise<void> {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    const snapshot = pending.current.get(id);
    if (!snapshot) return chains.current.get(id) ?? Promise.resolve();
    pending.current.delete(id);
    const revision = revisions.current.get(id);
    const chain = (chains.current.get(id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => repository.putNote(snapshot));
    chains.current.set(id, chain);
    chain.then(() => {
      if (revisions.current.get(id) === revision) markStatus(id, 'saved');
    }).catch(() => {
      if (revisions.current.get(id) === revision) markStatus(id, 'error');
      setStorageError('Could not save this note. Your changes are still visible here; export a backup before closing.');
    });
    return chain;
  }

  function scheduleSave(note: Note, immediate = false) {
    pending.current.set(note.id, note);
    revisions.current.set(note.id, (revisions.current.get(note.id) ?? 0) + 1);
    markStatus(note.id, 'saving');
    const timer = timers.current.get(note.id);
    if (timer !== undefined) window.clearTimeout(timer);
    if (immediate) void flushSave(note.id);
    else timers.current.set(note.id, window.setTimeout(() => void flushSave(note.id), 180));
  }

  useEffect(() => {
    let mounted = true;
    void Promise.all([repository.getNotes(), repository.getLastNoteId()])
      .then(([loaded, lastId]) => {
        if (!mounted) return;
        updateNotes(loaded);
        const newest = [...loaded].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setActiveId(loaded.some((note) => note.id === lastId) ? lastId : newest?.id ?? null);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setStorageError('Browser storage is unavailable. Notes you write now may not be saved.');
        setReady(true);
      });
    return () => { mounted = false; };
  }, [repository]);

  useEffect(() => {
    if (ready && !activeId) bodyRef.current?.focus();
  }, [ready, activeId]);

  useEffect(() => {
    const flushPending = () => {
      if (document.visibilityState === 'hidden') for (const id of pending.current.keys()) void flushSave(id);
    };
    document.addEventListener('visibilitychange', flushPending);
    return () => {
      document.removeEventListener('visibilitychange', flushPending);
      for (const id of pending.current.keys()) void flushSave(id);
    };
  }, [repository]);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;
  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...notes]
      .filter((note) => !needle || `${note.title}\n${note.body}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);

  function selectNote(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    void repository.setLastNoteId(id).catch(() => setStorageError('Could not remember the last opened note.'));
  }

  function createNote() {
    if (!ready) return;
    const now = Date.now();
    const note: Note = { id: crypto.randomUUID(), title: '', body: '', createdAt: now, updatedAt: now };
    updateNotes([note, ...notesRef.current]);
    setActiveId(note.id);
    setQuery('');
    setSidebarOpen(false);
    scheduleSave(note, true);
    void repository.setLastNoteId(note.id).catch(() => setStorageError('Could not remember the last opened note.'));
    window.requestAnimationFrame(() => bodyRef.current?.focus());
  }

  function editNote(field: 'title' | 'body', value: string) {
    const existing = notesRef.current.find((note) => note.id === activeId);
    const now = Date.now();
    const next: Note = existing
      ? { ...existing, [field]: value, updatedAt: now }
      : { id: crypto.randomUUID(), title: '', body: '', createdAt: now, updatedAt: now, [field]: value };
    updateNotes(existing
      ? notesRef.current.map((note) => note.id === next.id ? next : note)
      : [next, ...notesRef.current]);
    if (!existing) {
      setActiveId(next.id);
      void repository.setLastNoteId(next.id).catch(() => setStorageError('Could not remember the last opened note.'));
    }
    scheduleSave(next, !existing);
  }

  function deleteNote() {
    if (!activeNote) return;
    const note = activeNote;
    const remaining = notesRef.current.filter((item) => item.id !== note.id);
    updateNotes(remaining);
    const nextId = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
    setActiveId(nextId);
    void repository.setLastNoteId(nextId).catch(() => setStorageError('Could not remember the last opened note.'));
    const timer = timers.current.get(note.id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(note.id);
    pending.current.delete(note.id);
    revisions.current.delete(note.id);
    const removal = (chains.current.get(note.id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => repository.deleteNote(note.id));
    chains.current.set(note.id, removal);
    removal.catch(() => setStorageError('Could not delete this note. Please try again.'));
    setDeleted({ note, removal });
  }

  function undoDelete() {
    if (!deleted) return;
    const { note } = deleted;
    setDeleted(null);
    updateNotes([note, ...notesRef.current.filter((item) => item.id !== note.id)]);
    setActiveId(note.id);
    scheduleSave(note, true);
    void repository.setLastNoteId(note.id).catch(() => setStorageError('Could not remember the last opened note.'));
  }

  function downloadBackup() {
    const content = exportBackup(notesRef.current, new Date().toISOString());
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
      await repository.putNotes(imported);
      updateNotes([...imported, ...notesRef.current]);
      if (imported[0]) selectNote(imported[0].id);
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error && error.message === 'Invalid backup file'
        ? 'That file is not a valid Notas backup.'
        : 'Could not import the backup. Your existing notes are unchanged.');
    }
    if (importRef.current) importRef.current.value = '';
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createNote();
      } else if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSidebarOpen(true);
        window.requestAnimationFrame(() => searchRef.current?.focus());
      } else if (command && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (activeId) void flushSave(activeId);
      } else if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('');
        bodyRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const saveState = activeId ? statuses[activeId] ?? 'saved' : 'saved';
  const noteCount = notes.length;

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-overlay" aria-label="Close notes list" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Notes sidebar">
        <div className="sidebar-heading">
          <div className="brand"><span className="brand-mark"><Icon name="note" size={19} /></span><span>notas<span className="brand-dot">.</span></span></div>
          <button className="icon-button mobile-close" aria-label="Close notes list" onClick={() => setSidebarOpen(false)}><Icon name="close" /></button>
        </div>
        <div className="sidebar-inner">
          <button className="new-note" onClick={createNote} disabled={!ready}><Icon name="plus" size={19} /><span>New note</span><kbd>⌘ N</kbd></button>
          <label className="search-field"><Icon name="search" size={17} /><input ref={searchRef} type="search" aria-label="Search notes" placeholder="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
          <div className="list-heading"><span>{query ? 'SEARCH RESULTS' : 'YOUR NOTES'}</span><span>{visibleNotes.length}</span></div>
          <nav className="notes-list" aria-label="Notes">
            {visibleNotes.length ? visibleNotes.map((note) => (
              <button key={note.id} className={`note-item ${note.id === activeId ? 'active' : ''}`} onClick={() => selectNote(note.id)}>
                <span className="note-item-top"><strong>{displayTitle(note)}</strong><time>{noteDate(note.updatedAt)}</time></span>
                <span className="note-preview">{note.body.trim().replace(/\s+/g, ' ') || 'No additional text'}</span>
              </button>
            )) : <div className="empty-list">{query ? 'No matching notes.' : 'Your notes will appear here.'}</div>}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="privacy"><span className="privacy-light" /> Stored in this browser</div>
          <div className="footer-actions">
            <button onClick={downloadBackup} disabled={!noteCount} title="Download a JSON backup"><Icon name="download" size={16} /> Export</button>
            <button onClick={() => importRef.current?.click()} disabled={!ready} title="Import a JSON backup"><Icon name="upload" size={16} /> Import</button>
          </div>
          <input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Import backup file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadBackup(file); }} />
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-button" aria-label="Open notes list" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button><span className="workspace-label">MY WORKSPACE</span><span className="topbar-divider">/</span><span className="current-label">{activeNote ? displayTitle(activeNote) : 'New note'}</span></div>
          <div className="topbar-right"><span className={`save-indicator ${saveState}`} role="status"><span className="save-dot" />{!activeNote ? 'Ready to write' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Unable to save' : 'Saved locally'}</span>{activeNote && <button className="icon-button delete-button" aria-label="Delete note" title="Delete note" onClick={deleteNote}><Icon name="trash" size={17} /></button>}</div>
        </header>

        {storageError && <div className="error-banner" role="alert">{storageError}<button aria-label="Dismiss message" onClick={() => setStorageError('')}><Icon name="close" size={15} /></button></div>}

        <div className="editor-scroll">
          <div className="editor">
            <div className="editor-kicker"><span className="kicker-line" /> YOUR SPACE TO THINK</div>
            <input className="title-input" aria-label="Note title" placeholder="Untitled note" value={activeNote?.title ?? ''} onChange={(event) => editNote('title', event.target.value)} disabled={!ready} spellCheck />
            <div className="editor-meta"><span>{new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(activeNote?.createdAt ?? Date.now())}</span><span className="meta-separator" /><span>{activeNote?.body.trim() ? `${activeNote.body.trim().split(/\s+/).length} words` : 'Start writing below'}</span></div>
            <div className="editor-rule" />
            <textarea ref={bodyRef} className="body-input" aria-label="Note body" placeholder="The page is yours. Start writing…" value={activeNote?.body ?? ''} onChange={(event) => editNote('body', event.target.value)} onBlur={() => { if (activeId) void flushSave(activeId); }} disabled={!ready} spellCheck />
          </div>
        </div>
        <footer className="editor-footer"><span>PRIVATE BY DEFAULT <span className="footer-star">✦</span> ALWAYS YOURS</span><span>NOTAS / {String(noteCount).padStart(2, '0')} NOTES</span></footer>
      </main>

      {deleted && <div className="undo-toast" role="status"><span>Note deleted</span><button onClick={undoDelete}>Undo <Icon name="arrow" size={15} /></button></div>}
    </div>
  );
}
