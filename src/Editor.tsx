import { useEffect, useRef } from 'preact/hooks';
import {
  atomicEditorTheme,
  atomicMarkdownSyntax,
  autoCloseCodeFence,
  extendEmphasisPair,
  inlinePreview,
  startAsteriskList,
} from '@atomic-editor/editor';
import '@atomic-editor/editor/styles.css';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdownKeymap, markdownLanguage, pasteURLAsLink } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';

type EditorProps = {
  initialText: string;
  onChange: (text: string) => void;
  onSelect: (text: string) => void;
  onBlur: () => void;
};

// Markdown with Obsidian-style live preview. The text stays plain Markdown;
// syntax is only hidden away from the cursor.
export default function Editor({ initialText, onChange, onSelect, onBlur }: EditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onChange, onSelect, onBlur });
  handlers.current = { onChange, onSelect, onBlur };

  useEffect(() => {
    const view = new EditorView({
      parent: rootRef.current!,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          EditorView.lineWrapping,
          // The bare GFM language: `markdown()` would also bundle HTML, JS, and CSS parsers.
          markdownLanguage,
          pasteURLAsLink,
          atomicMarkdownSyntax,
          atomicEditorTheme,
          inlinePreview(),
          startAsteriskList,
          extendEmphasisPair,
          autoCloseCodeFence,
          keymap.of([...historyKeymap, ...markdownKeymap, indentWithTab, ...defaultKeymap]),
          placeholder('Start writing…'),
          EditorView.contentAttributes.of({ 'aria-label': 'Note', spellcheck: 'true' }),
          EditorView.updateListener.of((update) => {
            const { state } = update;
            if (update.docChanged) {
              handlers.current.onChange(state.doc.toString());
              // Writing at the end keeps the newest line clear of the faded bottom edge.
              if (state.selection.main.head === state.doc.length) {
                view.requestMeasure({ read: () => null, write: () => { view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight; } });
              }
            }
            if (update.docChanged || update.selectionSet || update.focusChanged) {
              const { from, to } = state.selection.main;
              handlers.current.onSelect(view.hasFocus ? state.sliceDoc(from, to) : '');
            }
          }),
          EditorView.domEventHandlers({ blur: () => handlers.current.onBlur() }),
        ],
      }),
    });
    view.focus();
    return () => view.destroy();
    // initialText seeds the document once; remount the component to load new text.
  }, []);

  return <div ref={rootRef} class="editor atomic-cm-editor" />;
}
