import { hydrate, render } from 'preact';
import App from './App';
import './styles.css';

if (typeof window !== 'undefined') {
  const root = document.getElementById('root')!;
  // Production HTML ships a prerendered shell; the dev server does not.
  (root.firstElementChild ? hydrate : render)(<App />, root);
}

// Called at build time by @preact/preset-vite to paint the shell into index.html.
export async function prerender() {
  const { renderToString } = await import('preact-render-to-string');
  return { html: renderToString(<App />) };
}
