# Notas

A minimal notepad that keeps your writing in the browser. No accounts, no server, no sync.

## Development

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev      # start the dev server
bun run test     # run tests
bun run build    # build the static site into dist/
bun run deploy   # build and deploy to Cloudflare Workers
```

To deploy from GitHub, add the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets and run the **Deploy to Cloudflare** workflow.

## Backups

Notes live in IndexedDB, so clearing site data or switching browsers loses them. Use the export and import buttons to save and restore a JSON backup.
