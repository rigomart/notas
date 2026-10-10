import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no layout; CodeMirror measures text ranges.
Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
