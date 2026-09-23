# Notas

A quiet, local-only notepad with one page to write on. Your text stays in IndexedDB in the browser where you write it. There are no accounts, server-side note storage, analytics, or sync.

## Run locally

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

Open the local URL printed by Vite. The editor is ready to write as soon as storage opens. On later visits, your text is restored automatically.

## Checks

```sh
bun run test
bun run build
```

`bun run build` creates a static site in `dist/`. The page shell is prerendered into `index.html` with its CSS inlined, so it paints before the Preact bundle loads. `bun run deploy` builds and deploys it as a Cloudflare Worker with static assets. Wrangler also assigns `notas.rigos.dev` as a Worker Custom Domain. Cloudflare creates the DNS record and certificate for that domain. No application server or runtime environment variables are required.

## Backups

Use the download icon to export a JSON backup and the upload icon to import one. Imported text is appended to the current page, so existing writing is kept. If you used an earlier version with several titled notes, Notas combines their titles and bodies into this one page when you first open it.

Browser storage belongs to this site and browser profile. Clearing site data, using private browsing, or changing devices can remove access to your writing. Export a backup for anything important. The small status dot changes color while saving or if storage fails, and Notas also shows an error when a save fails.

The bottom corner shows word and character counts, or counts for the selected text while you have a selection. While you type, the controls and counts fade away. They come back when you pause or move the pointer.

Keyboard shortcut: `⌘/Ctrl+S` saves pending edits.
