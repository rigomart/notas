import preact from '@preact/preset-vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The stylesheet is tiny, so ship it inside index.html and skip a render-blocking request.
function inlineCss(): Plugin {
  return {
    name: 'notas:inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        if (!bundle) return html;
        for (const [fileName, asset] of Object.entries(bundle)) {
          if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue;
          const link = new RegExp(`<link[^>]+href="[^"]*${fileName.replace(/\./g, '\\.')}"[^>]*>`);
          if (!link.test(html)) continue;
          html = html.replace(link, () => `<style>${String(asset.source).trim()}</style>`);
          delete bundle[fileName];
        }
        return html;
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    preact({ prerender: { enabled: true, renderTarget: '#root' } }),
    inlineCss(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
