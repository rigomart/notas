import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import App from './App';
import { createNotesRepository } from './storage';

describe('Notas', () => {
  it('opens straight into one focused editor and restores its text', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    const view = render(<App repository={repository} />);
    const editor = await screen.findByRole('textbox', { name: 'Note' });
    await waitFor(() => expect(editor).toHaveFocus());
    expect(screen.queryByRole('textbox', { name: 'Note title' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    fireEvent.input(editor, { target: { value: 'Remember milk' } });
    await waitFor(async () => expect((await repository.getNotes())[0]?.body).toBe('Remember milk'));

    view.unmount();
    render(<App repository={repository} />);
    expect(await screen.findByDisplayValue('Remember milk')).toBeInTheDocument();
    expect(await repository.getNotes()).toHaveLength(1);
  });

  it('keeps all existing note text when moving to one document', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    await repository.putNote({ id: 'one', title: 'Sketches', body: 'blue house', createdAt: 1, updatedAt: 1 });
    await repository.putNote({ id: 'two', title: 'Shopping', body: 'lemons', createdAt: 2, updatedAt: 2 });
    await repository.setLastNoteId('one');
    render(<App repository={repository} />);

    const editor = await screen.findByRole('textbox', { name: 'Note' });
    await waitFor(() => expect(editor).toHaveValue('Sketches\n\nblue house\n\n\nShopping\n\nlemons'));
    await waitFor(async () => {
      const notes = await repository.getNotes();
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('');
    });
  });

  it('waits for stored text before allowing edits', async () => {
    const base = createNotesRepository(crypto.randomUUID());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const repository = { ...base, getNotes: async () => { await gate; return base.getNotes(); } };
    render(<App repository={repository} />);

    const editor = screen.getByRole('textbox', { name: 'Note' });
    expect(editor).toBeDisabled();
    release();
    await waitFor(() => expect(editor).toBeEnabled());
  });

  it('counts words and characters and steps the chrome aside while writing', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    const { container } = render(<App repository={repository} />);
    const editor = await screen.findByRole('textbox', { name: 'Note' });
    await waitFor(() => expect(editor).toBeEnabled());
    const app = container.querySelector('main')!;
    expect(app).not.toHaveAttribute('data-writing');

    fireEvent.input(editor, { target: { value: 'one quiet line' } });
    expect(screen.getByText('3 words')).toBeInTheDocument();
    expect(screen.getByText('14 characters')).toBeInTheDocument();
    expect(app).toHaveAttribute('data-writing');

    fireEvent.input(editor, { target: { value: 'a' } });
    expect(screen.getByText('1 word')).toBeInTheDocument();
    expect(screen.getByText('1 character')).toBeInTheDocument();
    await waitFor(() => expect(app).not.toHaveAttribute('data-writing'), { timeout: 2500 });
  });

  it('counts only the selected text while there is a selection', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    render(<App repository={repository} />);
    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Note' });
    await waitFor(() => expect(editor).toHaveFocus());
    fireEvent.input(editor, { target: { value: 'one quiet line' } });

    editor.setSelectionRange(4, 14);
    fireEvent.select(editor);
    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('2 words')).toBeInTheDocument();
    expect(screen.getByText('10 characters')).toBeInTheDocument();

    editor.setSelectionRange(14, 14);
    fireEvent.select(editor);
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.getByText('3 words')).toBeInTheDocument();
  });
});
