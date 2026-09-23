# Notas

A quiet, local-only notepad. Notes stay in IndexedDB in the browser where you write them. There are no accounts, server-side note storage, analytics, or sync.

## Run locally

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

Open the local URL printed by Vite. The editor is ready to write as soon as storage opens. On later visits, Notas reopens the last selected note.

## Checks

```sh
bun run test
bun run build
```

`bun run build` creates a static site in `dist/`. The GitHub Actions workflow tests, builds, and publishes it to GitHub Pages when `main` changes. The relative asset paths also let the site work at the default `/notas/` Pages URL before the custom domain is connected. No application server or environment variables are required.

## Notes and backups

Use **Export** to download a versioned JSON file. **Import** checks the file before writing and adds its notes with new IDs, so it does not overwrite existing notes. Importing the same file twice creates two copies.

Browser storage belongs to this site and browser profile. Clearing site data, using private browsing, or changing devices can remove access to notes. Export a backup for anything important. Autosave reports **Saved locally** only after IndexedDB confirms the write; if storage fails, Notas shows an error.

Keyboard shortcuts: `⌘/Ctrl+N` creates a note, `⌘/Ctrl+K` focuses search, `⌘/Ctrl+S` saves pending edits, and `Esc` clears search.
