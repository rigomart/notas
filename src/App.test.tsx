import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { createNotesRepository } from './storage';

describe('Notas', () => {
  it('opens ready to write and restores the first note after reopening', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    const view = render(<App repository={repository} />);
    const body = await screen.findByRole('textbox', { name: 'Note body' });
    await waitFor(() => expect(body).toHaveFocus());

    fireEvent.change(body, { target: { value: 'Remember milk' } });
    await waitFor(async () => {
      expect((await repository.getNotes())[0]?.body).toBe('Remember milk');
    });

    view.unmount();
    render(<App repository={repository} />);
    expect(await screen.findByDisplayValue('Remember milk')).toBeInTheDocument();
  });

  it('searches title and body, then opens a matching note', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    await repository.putNote({ id: 'one', title: 'Sketches', body: 'blue house', createdAt: 1, updatedAt: 1 });
    await repository.putNote({ id: 'two', title: 'Shopping', body: 'lemons', createdAt: 2, updatedAt: 2 });
    render(<App repository={repository} />);

    const search = await screen.findByRole('searchbox', { name: 'Search notes' });
    fireEvent.change(search, { target: { value: 'blue' } });
    expect(screen.getByRole('button', { name: /Sketches/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Shopping/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sketches/ }));
    expect(screen.getByRole('textbox', { name: 'Note body' })).toHaveValue('blue house');
  });

  it('allows undo after deleting a note', async () => {
    const repository = createNotesRepository(crypto.randomUUID());
    await repository.putNote({ id: 'one', title: 'Keep me', body: 'text', createdAt: 1, updatedAt: 1 });
    render(<App repository={repository} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete note' }));
    expect(screen.queryByRole('button', { name: /Keep me/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => {
      expect((await repository.getNotes()).map((note) => note.id)).toContain('one');
    });
  });

  it('waits for stored notes before allowing a new note', async () => {
    const base = createNotesRepository(crypto.randomUUID());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const repository = { ...base, getNotes: async () => { await gate; return base.getNotes(); } };
    render(<App repository={repository} />);

    expect(screen.getByRole('button', { name: /New note/ })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: /New note/ })).toBeEnabled());
  });
});
