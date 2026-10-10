import { act, render, screen, waitFor } from '@testing-library/preact';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import App from './App';
import { createNotesRepository } from './storage';
import { formatLastUpdated } from './time';

const editorView = (editor: HTMLElement) => EditorView.findFromDOM(editor)!;
const editorText = (editor: HTMLElement) => editorView(editor).state.doc.toString();

function select(editor: HTMLElement, anchor: number, head = anchor) {
  act(() => editorView(editor).dispatch({ selection: { anchor, head } }));
}

function type(editor: HTMLElement, text: string) {
  const view = editorView(editor);
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: text.length } }));
}

describe('Notas', () => {
  it('opens straight into one focused editor and restores its text', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    const view = render(<App repository={repository} />);
    const editor = await screen.findByRole('textbox', { name: 'Note' });
    await waitFor(() => expect(editor).toHaveFocus());
    expect(screen.queryByRole('textbox', { name: 'Note title' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    type(editor, '# Remember milk');
    await waitFor(async () => expect((await repository.getNotes())[0]?.body).toBe('# Remember milk'));

    view.unmount();
    render(<App repository={repository} />);
    expect(editorText(await screen.findByRole('textbox', { name: 'Note' }))).toBe('# Remember milk');
    expect(await repository.getNotes()).toHaveLength(1);
  });

  it('keeps all existing note text when moving to one document', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    await repository.putNote({ id: 'one', title: 'Sketches', body: 'blue house', createdAt: 1, updatedAt: 1 });
    await repository.putNote({ id: 'two', title: 'Shopping', body: 'lemons', createdAt: 2, updatedAt: 2 });
    await repository.setLastNoteId('one');
    render(<App repository={repository} />);

    const editor = await screen.findByRole('textbox', { name: 'Note' });
    expect(editorText(editor)).toBe('Sketches\n\nblue house\n\n\nShopping\n\nlemons');
    await waitFor(async () => {
      const notes = await repository.getNotes();
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('');
      expect(notes[0].updatedAt).toBe(2);
    });
  });

  it('shows last updated next to the saving indicator', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    const updatedAt = new Date(2026, 0, 15, 9, 5).getTime();
    await repository.putNote({ id: 'one', title: '', body: 'kept', createdAt: 1, updatedAt });
    render(<App repository={repository} />);

    await screen.findByRole('textbox', { name: 'Note' });
    const updated = screen.getByLabelText(/last updated/i);
    expect(updated).toHaveTextContent(formatLastUpdated(updatedAt));
    expect(updated.textContent).toMatch(/\d{1,2}:\d{2} (AM|PM)$/);
    expect(updated.compareDocumentPosition(screen.getByRole('status')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('waits for stored text before showing the editor', async () => {
    const base = createNotesRepository(crypto.randomUUID());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const repository = { ...base, getNotes: async () => { await gate; return base.getNotes(); } };
    render(<App repository={repository} />);

    expect(screen.queryByRole('textbox', { name: 'Note' })).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('textbox', { name: 'Note' })).toBeInTheDocument();
  });

  it('counts words and characters and steps the chrome aside while writing', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    const { container } = render(<App repository={repository} />);
    const editor = await screen.findByRole('textbox', { name: 'Note' });
    const app = container.querySelector('main')!;
    expect(app).not.toHaveAttribute('data-writing');

    type(editor, 'one quiet line');
    expect(screen.getByText('3 words')).toBeInTheDocument();
    expect(screen.getByText('14 characters')).toBeInTheDocument();
    expect(app).toHaveAttribute('data-writing');

    type(editor, 'a');
    expect(screen.getByText('1 word')).toBeInTheDocument();
    expect(screen.getByText('1 character')).toBeInTheDocument();
    await waitFor(() => expect(app).not.toHaveAttribute('data-writing'), { timeout: 2500 });
  });

  it('counts only the selected text while there is a selection', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    render(<App repository={repository} />);
    const editor = await screen.findByRole('textbox', { name: 'Note' });
    await waitFor(() => expect(editor).toHaveFocus());
    type(editor, 'one quiet line');

    select(editor, 4, 14);
    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('2 words')).toBeInTheDocument();
    expect(screen.getByText('10 characters')).toBeInTheDocument();

    select(editor, 14);
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.getByText('3 words')).toBeInTheDocument();
  });
});
